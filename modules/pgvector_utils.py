"""
PGVectorStore utilities for the new langchain-postgres API.

This module provides centralized PGEngine and PGVectorStore management,
replacing the deprecated PGVector class that had connection issues in
Celery worker context.
"""
import logging
import threading
from typing import Optional, List
from flask import current_app

logger = logging.getLogger(__name__)

# Thread-safe singleton for PGEngine
_pg_engine = None
_pg_engine_lock = threading.Lock()
_table_initialized = False


def get_pg_engine():
    """
    Get or create a singleton PGEngine instance with connection pooling.
    
    The PGEngine manages database connections and should be reused
    across the application to benefit from connection pooling.
    
    Returns:
        PGEngine instance
    """
    global _pg_engine
    
    if _pg_engine is not None:
        return _pg_engine
    
    with _pg_engine_lock:
        # Double-check after acquiring lock
        if _pg_engine is not None:
            return _pg_engine
        
        from langchain_postgres import PGEngine
        
        connection_string = current_app.config.get('PGVECTOR_CONNECTION_STRING')
        if not connection_string:
            raise ValueError("PGVECTOR_CONNECTION_STRING is not configured")
        
        logger.info("Creating PGEngine singleton for connection pooling...")
        _pg_engine = PGEngine.from_connection_string(url=connection_string)
        logger.info("PGEngine created successfully")
        
        return _pg_engine


def ensure_table_exists(
    engine=None,
    table_name: str = None,
    vector_size: int = None,
    metadata_columns: Optional[List[tuple]] = None
):
    """
    Ensure the vectorstore table exists with the correct schema.
    
    This should be called once at application startup or during migration.
    It's safe to call multiple times - will skip if table already exists.
    
    Args:
        engine: PGEngine instance (uses singleton if not provided)
        table_name: Name of the table (default from config)
        vector_size: Embedding dimension (default from config)
        metadata_columns: List of (name, type) tuples for metadata columns
    """
    global _table_initialized
    
    if _table_initialized:
        return
    
    from langchain_postgres import Column
    from sqlalchemy.exc import ProgrammingError
    
    if engine is None:
        engine = get_pg_engine()
    
    if table_name is None:
        table_name = current_app.config.get('PGVECTOR_TABLE_NAME', 'document_vectors')
    
    if vector_size is None:
        vector_size = current_app.config.get('PGVECTOR_EMBEDDING_DIMENSION', 1536)
    
    # Default metadata columns for SmartLib documents
    if metadata_columns is None:
        metadata_columns = [
            ("library_id", "INTEGER"),
            ("library_name", "TEXT"),
            ("knowledge_id", "INTEGER"),
            ("doc_id", "TEXT"),
            ("source", "TEXT"),
            ("document_type", "TEXT"),
            ("brand_manufacturer_organization", "TEXT"),
            ("product_model_name_service", "TEXT"),
            ("main_subject_topic", "TEXT"),
            ("language", "TEXT"),
        ]
    
    # Convert to Column objects
    columns = [Column(name, dtype) for name, dtype in metadata_columns]
    
    logger.info(f"Ensuring vectorstore table '{table_name}' exists (vector_size={vector_size})...")
    
    try:
        engine.init_vectorstore_table(
            table_name=table_name,
            vector_size=vector_size,
            metadata_columns=columns,
        )
        _table_initialized = True
        logger.info(f"Vectorstore table '{table_name}' is ready")
    except ProgrammingError as e:
        # Table already exists - this is fine
        if "already exists" in str(e).lower() or "duplicatetable" in str(type(e).__name__).lower():
            _table_initialized = True
            logger.info(f"Vectorstore table '{table_name}' already exists")
        else:
            raise
    except Exception as e:
        # Also catch psycopg.errors.DuplicateTable directly
        if "duplicatetable" in str(type(e).__name__).lower() or "already exists" in str(e).lower():
            _table_initialized = True
            logger.info(f"Vectorstore table '{table_name}' already exists")
        else:
            raise


def get_pg_vector_store(embedding_service, table_name: str = None, metadata_columns: Optional[List[str]] = None):
    """
    Get a PGVectorStore instance for document operations.
    
    Args:
        embedding_service: LangChain embedding function
        table_name: Name of the table (default from config)
        metadata_columns: List of metadata column names to use for filtering
    
    Returns:
        PGVectorStore instance
    """
    from langchain_postgres import PGVectorStore
    
    engine = get_pg_engine()
    
    if table_name is None:
        table_name = current_app.config.get('PGVECTOR_TABLE_NAME', 'document_vectors')
    
    # Ensure table exists before creating store
    ensure_table_exists(engine=engine, table_name=table_name)
    
    # Default metadata columns for filtering
    if metadata_columns is None:
        metadata_columns = [
            "library_id",
            "library_name", 
            "knowledge_id",
            "doc_id",
            "source",
            "document_type",
        ]
    
    logger.debug(f"Creating PGVectorStore for table '{table_name}'")
    
    store = PGVectorStore.create_sync(
        engine=engine,
        table_name=table_name,
        embedding_service=embedding_service,
        metadata_columns=metadata_columns,
    )
    
    return store


def reset_pg_engine():
    """
    Reset the PGEngine singleton (useful for testing or reconfiguration).
    """
    global _pg_engine, _table_initialized
    with _pg_engine_lock:
        _pg_engine = None
        _table_initialized = False
        logger.info("PGEngine singleton reset")
