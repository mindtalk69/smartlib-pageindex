import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from celery_app import celery
from flask import current_app

logger = logging.getLogger(__name__)

# ============================================================================
# ChromaDB Client Cache (Performance Optimization)
# Reusing clients avoids expensive re-initialization (25s → <1s)
# ============================================================================
_chroma_client_cache: Dict[str, any] = {}

def get_cached_chroma_client(persist_directory: str):
    """
    Get or create a cached ChromaDB PersistentClient for the given directory.

    This dramatically improves performance by reusing clients instead of
    re-initializing them on every operation (25s → <1s).

    Args:
        persist_directory: Path to ChromaDB persistence directory

    Returns:
        Cached ChromaDB PersistentClient instance
    """
    try:
        import chromadb
    except ImportError as exc:
        logger.error("ChromaDB is not installed in this environment: %s", exc)
        raise

    # Normalize path for consistent caching
    normalized_path = str(Path(persist_directory).resolve())

    if normalized_path not in _chroma_client_cache:
        logger.info(f"[ChromaDB Cache] Creating new client for: {normalized_path}")
        _chroma_client_cache[normalized_path] = chromadb.PersistentClient(path=normalized_path)
    else:
        logger.debug(f"[ChromaDB Cache] Reusing cached client for: {normalized_path}")

    return _chroma_client_cache[normalized_path]


@celery.task(name="modules.vector_tasks.retrieve_context")
def retrieve_context_task(query: str, tool_call_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute document retrieval on the worker to keep web images slim."""
    from modules.agent import perform_retrieval

    config = tool_call_config or {}
    result = perform_retrieval(query, config)

    documents = result.get("documents") or []
    serialized_docs: List[Dict[str, Any]] = []
    for doc in documents:
        serialized_docs.append(
            {
                "page_content": getattr(doc, "page_content", ""),
                "metadata": getattr(doc, "metadata", {}) or {},
            }
        )
    result["documents"] = serialized_docs
    return result


@celery.task(name="modules.vector_tasks.fetch_document_chunks")
def fetch_document_chunks(persist_directory: str, collection_name: str, document_id: str, vector_provider: Optional[str] = None) -> Dict[str, object]:
    """Fetch document chunks from vector store (ChromaDB or PGVector).

    Args:
        persist_directory: Path where the Chroma collection is persisted (ChromaDB only).
        collection_name: Name of the vector store collection.
        document_id: UUID string of the document to retrieve.
        vector_provider: 'chromadb' or 'pgvector'. Auto-detected from env if not provided.

    Returns:
        Dictionary containing documents and metadatas lists.
    """
    import os

    # Auto-detect provider if not specified
    if vector_provider is None:
        vector_provider = os.environ.get('VECTOR_STORE_PROVIDER', 'chromadb')

    logger.info(f"[FetchChunks] Using vector provider: {vector_provider}")

    # === PGVector Backend ===
    if vector_provider == 'pgvector':
        try:
            from langchain_postgres import PGVector
            from modules.llm_utils import get_embedding_function
        except ImportError as exc:
            logger.error("PGVector dependencies not installed: %s", exc)
            raise

        try:
            connection_string = os.environ.get('PGVECTOR_CONNECTION_STRING')
            if not connection_string:
                logger.error("PGVECTOR_CONNECTION_STRING not set")
                return {"documents": [], "metadatas": []}

            embed_func = get_embedding_function()

            # Initialize PGVector store
            store = PGVector(
                connection=connection_string,
                embeddings=embed_func,
                collection_name=collection_name,
                use_jsonb=True
            )

            # Query by metadata filter
            # Try multiple field names in priority order
            from langchain_core.documents import Document
            results = []

            for field in ["doc_id", "document_id", "source", "file_id"]:
                try:
                    results = store.similarity_search(
                        query="",  # Empty query, we just want metadata matches
                        k=100,  # Get many chunks from this document
                        filter={field: document_id}
                    )
                    if results:
                        logger.info(f"[PGVectorFetch] Found {len(results)} chunks using metadata field '{field}'")
                        break
                except Exception as e:
                    logger.debug(f"[PGVectorFetch] Failed to query with field '{field}': {e}")
                    continue

            documents = [doc.page_content for doc in results]
            metadatas = [doc.metadata for doc in results]

            logger.info(f"[PGVectorFetch] Retrieved {len(documents)} chunks for document {document_id}")
            return {"documents": documents, "metadatas": metadatas}

        except Exception as exc:
            logger.exception("Failed to fetch document chunks from PGVector for %s", document_id)
            raise

    # === ChromaDB Backend ===
    elif vector_provider == 'chromadb':
        try:
            import chromadb
            from chromadb.errors import NotFoundError
        except ImportError as exc:
            logger.error("ChromaDB is not installed in this environment: %s", exc)
            # Return empty instead of raising for Enterprise compatibility
            return {"documents": [], "metadatas": []}

        try:
            # Use cached client for performance (25s → <1s)
            client = get_cached_chroma_client(persist_directory)
            try:
                collection = client.get_collection(name=collection_name)
            except NotFoundError as missing_collection:
                logger.info(
                    "Chroma collection '%s' not found at '%s': %s",
                    collection_name,
                    persist_directory,
                    missing_collection,
                )
                return {"documents": [], "metadatas": []}

            result = collection.get(ids=[document_id])
            documents = list(result.get("documents") or [])
            metadatas = list(result.get("metadatas") or [])
            
            # --- Azure Files Fix: Retry with fresh client if empty (stale cache check) ---
            if not documents:
                logger.info("[ChromaFetch] No docs found with cached client. refreshing client to check for stale cache...")
                # Invalidate cache
                normalized_path = str(Path(persist_directory).resolve())
                if normalized_path in _chroma_client_cache:
                    del _chroma_client_cache[normalized_path]
                
                # Get fresh client and retry
                client = get_cached_chroma_client(persist_directory)
                collection = client.get_collection(name=collection_name)
                result = collection.get(ids=[document_id])
                documents = list(result.get("documents") or [])
                metadatas = list(result.get("metadatas") or [])
                logger.info("[ChromaFetch] Retry result: %d docs", len(documents))
            # -----------------------------------------------------------------------------

            logger.info("[ChromaFetch] lookup by id %s returned %d docs", document_id, len(documents))

            if not documents and document_id:
                compact_id = document_id.replace('-', '')
                if compact_id != document_id:
                    result = collection.get(ids=[compact_id])
                    documents = list(result.get("documents") or [])
                    metadatas = list(result.get("metadatas") or [])
                    logger.info("[ChromaFetch] lookup by compact id %s returned %d docs", compact_id, len(documents))

            if not documents:
                result = collection.get(where={"doc_id": document_id})
                documents = list(result.get("documents") or [])
                metadatas = list(result.get("metadatas") or [])
                logger.info(
                    "[ChromaFetch] lookup by metadata doc_id=%s returned %d docs",
                    document_id,
                    len(documents),
                )

            return {"documents": documents, "metadatas": metadatas}
        except Exception as exc:
            logger.exception("Failed to fetch document chunks for %s from %s", document_id, collection_name)
            raise

    else:
        logger.error(f"Unsupported vector provider: {vector_provider}")
        return {"documents": [], "metadatas": []}


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
            # Use FRESH client for listing to ensure accuracy on Azure Files (bypass cache)
            # client = get_cached_chroma_client(str(store_dir)) 
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
        # Use cached client for performance (25s → <1s)
        client = get_cached_chroma_client(persist_directory)
        client.delete_collection(name=collection_name)

        # Invalidate cache after deletion to force reload
        normalized_path = str(Path(persist_directory).resolve())
        if normalized_path in _chroma_client_cache:
            del _chroma_client_cache[normalized_path]
            logger.info(f"[ChromaDB Cache] Invalidated cache for: {normalized_path}")
        return True
    except Exception as exc:
        logger.exception(
            "Failed to delete Chroma collection %s from %s", collection_name, persist_directory
        )
        raise
