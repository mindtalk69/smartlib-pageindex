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
    """Fetch document chunks from vector store (sqlite-vec or PGVector).

    Args:
        persist_directory: Path to vector store (unused for sqlite-vec).
        collection_name: Name of the vector store collection/table.
        document_id: UUID string of the document to retrieve.
        vector_provider: 'sqlite-vec' or 'pgvector'. Auto-detected from env if not provided.

    Returns:
        Dictionary containing documents and metadatas lists.
    """
    import os

    # Auto-detect provider if not specified
    if vector_provider is None:
        vector_provider = os.environ.get('VECTOR_STORE_PROVIDER', 'sqlite-vec')

    logger.info(f"[FetchChunks] Using vector provider: {vector_provider}")

    # === sqlite-vec Backend (BASIC Edition Default) ===
    if vector_provider == 'sqlite-vec':
        try:
            from langchain_community.vectorstores import SQLiteVec
            from modules.llm_utils import get_embedding_function
        except ImportError as exc:
            logger.error("sqlite-vec dependencies not installed: %s", exc)
            raise

        try:
            embed_func = get_embedding_function()

            # Get SQLite database path
            db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///app.db')
            db_path = db_uri.replace('sqlite:///', '', 1)
            if not os.path.isabs(db_path):
                db_path = str(Path(db_path).absolute())

            table_name = current_app.config.get('SQLITE_VECTOR_TABLE_NAME', 'document_vectors')

            from modules.vector_store_utils import make_sqlite_vec_store
            store = make_sqlite_vec_store(
                db_path=db_path,
                table_name=table_name,
                embedding_function=embed_func,
            )

            # Query by metadata filter - try multiple field names
            results = []
            for field in ["doc_id", "document_id", "source", "file_id"]:
                try:
                    results = store.similarity_search(
                        query="",  # Empty query, we just want metadata matches
                        k=100,  # Get many chunks from this document
                        filter={field: document_id}
                    )
                    if results:
                        logger.info(f"[SQLiteVecFetch] Found {len(results)} chunks using metadata field '{field}'")
                        break
                except Exception as e:
                    logger.debug(f"[SQLiteVecFetch] Failed to query with field '{field}': {e}")
                    continue

            documents = [doc.page_content for doc in results]
            metadatas = [doc.metadata for doc in results]

            logger.info(f"[SQLiteVecFetch] Retrieved {len(documents)} chunks for document {document_id}")
            return {"documents": documents, "metadatas": metadatas}

        except Exception as exc:
            logger.exception("Failed to fetch document chunks from SQLiteVec for %s", document_id)
            raise

    # === PGVector Backend (Enterprise Edition) ===
    elif vector_provider == 'pgvector':
        try:
            from modules.pgvector_utils import get_pg_vector_store
            from modules.llm_utils import get_embedding_function
        except ImportError as exc:
            logger.error("PGVector dependencies not installed: %s", exc)
            raise

        try:
            embed_func = get_embedding_function()
            store = get_pg_vector_store(embed_func, collection_name=collection_name)

            # Query by metadata filter - try multiple field names
            results = []
            for field in ["doc_id", "document_id", "source", "file_id"]:
                try:
                    results = store.similarity_search(
                        query="",
                        k=100,
                        filter={field: document_id}
                    )
                    if results:
                        logger.info(f"[PGVectorStoreFetch] Found {len(results)} chunks using metadata field '{field}'")
                        break
                except Exception as e:
                    logger.debug(f"[PGVectorStoreFetch] Failed to query with field '{field}': {e}")
                    continue

            documents = [doc.page_content for doc in results]
            metadatas = [doc.metadata for doc in results]

            logger.info(f"[PGVectorStoreFetch] Retrieved {len(documents)} chunks for document {document_id}")
            return {"documents": documents, "metadatas": metadatas}

        except Exception as exc:
            logger.exception("Failed to fetch document chunks from PGVectorStore for %s", document_id)
            raise

    else:
        logger.error(f"Unsupported vector provider: {vector_provider}")
        return {"documents": [], "metadatas": []}


@celery.task(name="modules.vector_tasks.list_vector_stores")
def list_vector_stores() -> Dict[str, object]:
    """List vector stores for the configured provider.

    For sqlite-vec (BASIC edition): Returns SQLite database information.
    For PGVector (Enterprise edition): Returns PostgreSQL connection info.
    """
    vector_provider = current_app.config.get('VECTOR_STORE_PROVIDER', 'sqlite-vec')

    if vector_provider == 'sqlite-vec':
        from modules.llm_utils import get_current_embedding_model

        db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///app.db')
        table_name = current_app.config.get('SQLITE_VECTOR_TABLE_NAME', 'document_vectors')

        return {
            "provider": "sqlite-vec",
            "database": db_uri,
            "table": table_name,
            "embedding_model": get_current_embedding_model(),
        }
    elif vector_provider == 'pgvector':
        from modules.llm_utils import get_current_embedding_model

        collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')

        return {
            "provider": "pgvector",
            "collection": collection_name,
            "embedding_model": get_current_embedding_model(),
        }
    else:
        logger.error(f"Unsupported vector provider: {vector_provider}")
        return {"error": f"Unsupported vector provider: {vector_provider}"}


@celery.task(name="modules.vector_tasks.delete_document_vectors")
def delete_document_vectors(
    persist_directory: str,
    collection_name: str,
    doc_ids: List[str],
) -> Dict[str, object]:
    """Delete specific document vectors.

    For sqlite-vec (BASIC): Vectors are deleted via database cascade deletes when Document records are deleted.
    For PGVector (Enterprise): Vectors are deleted via database operations.

    This task is kept for API compatibility but vector deletion is handled by the database.

    Args:
        persist_directory: Path to vector store (unused).
        collection_name: Name of the vector store collection/table (unused).
        doc_ids: List of document IDs to delete.

    Returns:
        Dictionary with 'deleted_count' and 'success' keys.
    """
    vector_provider = current_app.config.get('VECTOR_STORE_PROVIDER', 'sqlite-vec')

    if vector_provider in ('sqlite-vec', 'pgvector'):
        # For sqlite-vec and PGVector, vector deletion is handled by database cascade deletes
        # when the associated Document records are deleted
        logger.info(
            "[DeleteVectors] Vector deletion for %s is handled by database cascade deletes. "
            "Delete Document records instead.",
            vector_provider
        )
        return {
            "success": True,
            "deleted_count": 0,
            "message": f"Vector deletion for {vector_provider} is handled by database cascade deletes"
        }

    logger.error(f"Unsupported vector provider: {vector_provider}")
    return {"success": False, "deleted_count": 0, "error": f"Unsupported vector provider: {vector_provider}"}
