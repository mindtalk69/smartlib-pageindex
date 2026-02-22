from flask import current_app
import logging
import os
import re
# PGVectorStore utilities imported when needed (lazy import to avoid circular deps)
# SQLiteVec utilities imported from langchain_community.vectorstores

from langchain_community.vectorstores.utils import filter_complex_metadata
from modules.llm_utils import get_lc_store_path, get_embedding_function
from langchain.docstore.document import Document # Langchain Document object
from datetime import datetime
import json

logger = logging.getLogger(__name__)


def make_sqlite_vec_store(db_path: str, table_name: str, embedding_function) -> "SQLiteVec":
    """Create a SQLiteVec store with the correct constructor signature.

    langchain_community.vectorstores.SQLiteVec requires:
      - a raw sqlite3 connection (NOT a connection_string)
      - row_factory = sqlite3.Row so column names work in fetchone()
      - the sqlite_vec extension loaded before passing the connection

    Args:
        db_path: Absolute path to the SQLite database file.
        table_name: Name of the vector table (will be created if not exists).
        embedding_function: LangChain Embeddings instance.

    Returns:
        Initialized SQLiteVec instance ready for add_documents/similarity_search.
    """
    import sqlite3

    import sqlite_vec as _sqlite_vec
    from langchain_community.vectorstores import SQLiteVec

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row  # Required for .fetchone()['column'] access
    connection.enable_load_extension(True)
    _sqlite_vec.load(connection)
    connection.enable_load_extension(False)

    return SQLiteVec(
        table=table_name,
        connection=connection,
        embedding=embedding_function,
        db_file=db_path,
    )


# Attempt to import tenacity for retry logic
try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
    from sqlalchemy.exc import OperationalError
    HAS_TENACITY = True
except ImportError:
    logger.warning("Tenacity or SQLAlchemy not found. Retry logic for PGVectorStore will be disabled.")
    HAS_TENACITY = False


def _add_documents_with_retry(store, documents, ids, batch_size=20):
    """
    Helper function to add documents to PGVectorStore with retry logic.
    Processes documents in batches to avoid OOM when generating embeddings.
    
    Args:
        store: The PGVector store instance
        documents: List of documents to add
        ids: List of IDs corresponding to documents
        batch_size: Number of documents to process per batch (default 20)
    """
    total_docs = len(documents)
    logger.info(f"Adding {total_docs} documents to PGVectorStore in batches of {batch_size}...")
    
    # Process in batches to reduce peak memory usage during embedding generation
    for batch_start in range(0, total_docs, batch_size):
        batch_end = min(batch_start + batch_size, total_docs)
        batch_docs = documents[batch_start:batch_end]
        batch_ids = ids[batch_start:batch_end] if ids else None
        
        batch_num = (batch_start // batch_size) + 1
        total_batches = (total_docs + batch_size - 1) // batch_size
        logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch_docs)} documents)...")
        
        if HAS_TENACITY:
            @retry(
                stop=stop_after_attempt(5),
                wait=wait_exponential(multiplier=1, min=2, max=30),
                retry=retry_if_exception_type(OperationalError),
                reraise=True
            )
            def _add_batch():
                return store.add_documents(batch_docs, ids=batch_ids)
            _add_batch()
        else:
            store.add_documents(batch_docs, ids=batch_ids)
        
        logger.info(f"Batch {batch_num}/{total_batches} completed successfully.")
    
    logger.info(f"All {total_docs} documents added successfully.")
    return total_docs



def log_vector_reference(file_id, url_download_id, chunk_index):
    """
    Logs vector reference information to a file instead of the database.
    Log files are created daily.
    """
    log_dir = current_app.config.get('LOG_DIR')
    if not log_dir:
        data_volume = current_app.config.get('DATA_VOLUME_PATH') or os.path.join(current_app.root_path, 'data')
        log_dir = os.path.join(data_volume, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_filename = f"vector_references_{datetime.utcnow().strftime('%Y-%m-%d')}.log"
    log_file = os.path.join(log_dir, log_filename)

    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "file_id": file_id,
        "url_download_id": url_download_id,
        "chunk_index": chunk_index
    }

    with open(log_file, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

def process_and_store_chunks(splits, user_id, embedding_function, logger, file_id=None, url_download_id=None, knowledge_id=None, new_uuid_indexes=None):
    """
    Processes document splits, creates/updates a Langchain sqlite-vec or pgvector vector store,
    and saves it locally. Also records vector references in the database.

    Args:
        splits (list[Document]): List of Langchain Document objects to process.
        user_id (int): The ID of the current user.
        embedding_function: The embedding function instance (e.g., HuggingFaceEmbeddings).
        logger: The logger instance.
        file_id (int, optional): The ID of the uploaded file if applicable. Defaults to None.
        url_download_id (int, optional): The ID of the URL download if applicable. Defaults to None.
        knowledge_id (int, optional): The ID of the knowledge base if applicable. Defaults to None.
        new_uuid_indexes (list[str], optional): List of UUID strings to use as vector IDs. Defaults to None.

    Returns:
        int: The number of splits processed.
    """
    if not splits:
        logger.warning("process_and_store_chunks called with no splits.")
        return 0

    vector_provider = current_app.config.get('VECTOR_STORE_PROVIDER', 'sqlite-vec')
    store_mode = current_app.config.get('VECTOR_STORE_MODE', 'knowledge')
    logger.info(f"Processing {len(splits)} chunks for vector store provider: {vector_provider}")

    try:
        # DEBUG: Log sample metadata BEFORE filtering
        if splits and len(splits) > 0:
            sample_metadata_before = splits[0].metadata
            logger.info(f"[VectorStore DEBUG] Sample metadata BEFORE filter_complex_metadata: {list(sample_metadata_before.keys())}")
            if 'docling_json_path' in sample_metadata_before:
                logger.info(f"[VectorStore DEBUG] docling_json_path BEFORE filtering: {sample_metadata_before['docling_json_path']}")
            else:
                logger.warning(f"[VectorStore DEBUG] docling_json_path NOT in metadata before filtering")

        # Ensure complex metadata like 'dl_meta' is filtered out before sending to vector store
        # The 'documents' table in the DB is the place for this complex metadata.
        splits = filter_complex_metadata(splits)

        # DEBUG: Log sample metadata AFTER filtering
        if splits and len(splits) > 0:
            sample_metadata_after = splits[0].metadata
            logger.info(f"[VectorStore DEBUG] Sample metadata AFTER filter_complex_metadata: {list(sample_metadata_after.keys())}")
            if 'docling_json_path' in sample_metadata_after:
                logger.info(f"[VectorStore DEBUG] ✓ docling_json_path PRESERVED after filtering: {sample_metadata_after['docling_json_path']}")
            else:
                logger.warning(f"[VectorStore DEBUG] ✗ docling_json_path REMOVED by filtering (this is unexpected!)")


        # --- Log Vector References ---
        if len(splits) > 0:
            logger.info(f"Logging vector references for {len(splits)} chunks")
            for chunk_index, split_doc in enumerate(splits):
                try:
                    log_vector_reference(
                        file_id=file_id,
                        url_download_id=url_download_id,
                        chunk_index=chunk_index
                    )
                except Exception as log_e:
                    logger.error(f"Failed to log vector reference for chunk {chunk_index}: {log_e}", exc_info=True)
                    # Decide on error handling. For now, we'll log and continue,
                    # as it's a logging operation, not a transactional one.
                    pass # Or `raise` if this should be a critical failure

            logger.info(f"Successfully logged {len(splits)} vector references")

        # --- PGVector with SQLAlchemy Engine ---
        if vector_provider == 'pgvector':
            try:
                from modules.pgvector_utils import get_pg_vector_store
                
                collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')
                
                logger.info(f"Initializing PGVector store. Collection: '{collection_name}'")
                
                # Get store instance using SQLAlchemy engine (avoids async issues in Flask/Celery)
                pgvector_store = get_pg_vector_store(embedding_function, collection_name=collection_name)
                
                # Add documents with retry logic
                _add_documents_with_retry(
                    store=pgvector_store,
                    documents=splits,
                    ids=new_uuid_indexes,
                )
                
                logger.info(f"PGVector: Successfully added {len(splits)} chunks to collection '{collection_name}'.")
                
                return len(splits)  # Return number of chunks processed
            except Exception as e:
                logger.error(f"Error processing/storing chunks for PGVector: {e}", exc_info=True)
                # Re-raise the exception so the calling function can handle rollback etc.
                raise

        # --- sqlite-vec ---
        elif vector_provider == 'sqlite-vec':
            from langchain_community.vectorstores import SQLiteVec

            # Get the SQLite database path from the main database URI
            db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI')
            # Extract path from sqlite:/// URI
            if db_uri.startswith('sqlite:///'):
                db_path = db_uri.replace('sqlite:///', '', 1)
                if not os.path.isabs(db_path):
                    db_path = os.path.join(basedir, db_path)
            else:
                raise ValueError(f"Expected sqlite:/// URI, got: {db_uri}")

            # Get configuration settings
            vector_dimension = current_app.config.get('SQLITE_VECTOR_DIMENSION', 1536)
            table_name = current_app.config.get('SQLITE_VECTOR_TABLE_NAME', 'document_vectors')

            logger.info(f"Initializing sqlite-vec at {db_path}, Table: {table_name}, Dimension: {vector_dimension}")

            sqlite_vec_store = make_sqlite_vec_store(
                db_path=db_path,
                table_name=table_name,
                embedding_function=embedding_function,
            )

            logger.info(f"Adding {len(splits)} documents to sqlite-vec in batches.")

            # Add documents with batching to avoid memory issues
            batch_size = 1000  # Conservative batch size for sqlite-vec
            for i in range(0, len(splits), batch_size):
                batch_splits = splits[i:i + batch_size]
                batch_ids = new_uuid_indexes[i:i + batch_size] if new_uuid_indexes else None

                logger.info(f"Processing batch {i // batch_size + 1}/{(len(splits) + batch_size - 1) // batch_size}...")
                sqlite_vec_store.add_documents(documents=batch_splits, ids=batch_ids)

            logger.info(f"Finished adding/updating documents in sqlite-vec table '{table_name}' at {db_path}")

        else:
            logger.error(f"Unsupported VECTOR_STORE_PROVIDER: {vector_provider}")
            raise ValueError(f"Unsupported vector store provider: {vector_provider}")

        return len(splits) # Return number of chunks processed

    except Exception as e:
        logger.error(f"Error processing/storing chunks for provider {vector_provider}: {e}", exc_info=True)
        # Re-raise the exception so the calling function (process_uploaded_file) can handle rollback etc.
        raise
