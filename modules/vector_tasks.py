import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from celery_app import celery
from flask import current_app

logger = logging.getLogger(__name__)


@celery.task(name="modules.vector_tasks.retrieve_context")
def retrieve_context_task(query: str, tool_call_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute document retrieval on the worker to keep web images slim."""
    from modules.agent import perform_retrieval

    config = tool_call_config or {}
    return perform_retrieval(query, config)


@celery.task(name="modules.vector_tasks.fetch_document_chunks")
def fetch_document_chunks(persist_directory: str, collection_name: str, document_id: str) -> Dict[str, object]:
    """Fetch document chunks from a Chroma collection.

    Args:
        persist_directory: Path where the Chroma collection is persisted.
        collection_name: Name of the Chroma collection.
        document_id: UUID string of the document to retrieve.

    Returns:
        Dictionary containing documents and metadatas lists.
    """
    try:
        import chromadb
    except ImportError as exc:
        logger.error("ChromaDB is not installed in this environment: %s", exc)
        raise

    try:
        client = chromadb.PersistentClient(path=persist_directory)
        collection = client.get_collection(name=collection_name)
        result = collection.get(where={"doc_id": document_id})
        documents = list(result.get("documents") or [])
        metadatas = list(result.get("metadatas") or [])
        return {"documents": documents, "metadatas": metadatas}
    except Exception as exc:
        logger.exception("Failed to fetch document chunks for %s from %s", document_id, collection_name)
        raise


@celery.task(name="modules.vector_tasks.list_chroma_stores")
def list_chroma_stores(base_path: Optional[str] = None) -> Dict[str, object]:
    """Enumerate local Chroma vector stores and their collections."""
    try:
        import chromadb
    except ImportError as exc:
        logger.error("ChromaDB is not installed in this environment: %s", exc)
        raise

    from modules.llm_utils import get_current_embedding_model
    from modules.database import Knowledge

    path_to_scan = Path(base_path or current_app.config.get("LOCAL_VECTOR_STORE_BASE_PATH", "data/chroma"))
    stores: List[Dict[str, object]] = []
    if not path_to_scan.exists() or not path_to_scan.is_dir():
        logger.info("Chroma base path %s does not exist or is not a directory", path_to_scan)
        return {"stores": stores, "embedding": get_current_embedding_model(), "base_path": str(path_to_scan)}

    embedding_model = get_current_embedding_model()

    for store_dir in sorted(path_to_scan.iterdir()):
        if not store_dir.is_dir():
            continue

        chroma_sqlite = store_dir / "chroma.sqlite3"
        if not chroma_sqlite.exists():
            continue

        formatted_scope = store_dir.name
        if store_dir.name.startswith("knowledge_"):
            try:
                knowledge_id = int(store_dir.name.split("_")[1])
                knowledge = Knowledge.query.get(knowledge_id)
                if knowledge:
                    formatted_scope = f"{store_dir.name} ({knowledge.name})"
            except (ValueError, IndexError):
                logger.debug("Unable to parse knowledge id from %s", store_dir.name)
        formatted_scope = f"{formatted_scope} - {embedding_model}"

        collections: List[Dict[str, object]] = []

        try:
            client = chromadb.PersistentClient(path=str(store_dir))
            for coll in client.list_collections():
                try:
                    count = coll.count()
                except Exception as count_exc:
                    logger.debug("Failed counting documents for %s: %s", coll.name, count_exc)
                    count = None
                collections.append({"name": coll.name, "count": count})
        except Exception as coll_exc:
            logger.exception("Failed to list collections for %s", store_dir)
            stores.append({
                "scope": formatted_scope,
                "path": str(store_dir),
                "error": str(coll_exc),
            })
            continue

        stores.append({
            "scope": formatted_scope,
            "path": str(store_dir),
            "collections": collections,
        })

    return {"stores": stores, "embedding": embedding_model, "base_path": str(path_to_scan)}


@celery.task(name="modules.vector_tasks.delete_chroma_collection")
def delete_chroma_collection(persist_directory: str, collection_name: str) -> bool:
    """Remove a Chroma collection."""
    try:
        import chromadb
    except ImportError as exc:
        logger.error("ChromaDB is not installed in this environment: %s", exc)
        raise

    try:
        client = chromadb.PersistentClient(path=persist_directory)
        client.delete_collection(name=collection_name)
        return True
    except Exception as exc:
        logger.exception(
            "Failed to delete Chroma collection %s from %s", collection_name, persist_directory
        )
        raise
