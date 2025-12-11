"""
PGVector utilities using SQLAlchemy Engine approach.

This module provides centralized PGVector management using Flask-SQLAlchemy's
engine to avoid async event loop issues that occur with PGEngine in Flask context.
"""
import logging
import threading
from typing import Optional, List
from flask import current_app

logger = logging.getLogger(__name__)

# Thread-safe cache for initialized flag
_collection_initialized = {}
_init_lock = threading.Lock()


def get_pg_vector_store(embedding_service, collection_name: str = None):
    """
    Get a PGVector store instance using SQLAlchemy engine.
    
    Uses Flask-SQLAlchemy's db.engine to avoid async event loop issues
    that occur with PGEngine in Flask/Celery context.
    
    Args:
        embedding_service: LangChain embedding function
        collection_name: Name of the collection (default from config)
    
    Returns:
        PGVector instance
    """
    from langchain_postgres import PGVector
    from extensions import db
    
    if collection_name is None:
        collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')
    
    # Use Flask-SQLAlchemy's engine - this works in Flask context!
    engine = db.engine
    
    logger.info(f"Creating PGVector store with SQLAlchemy engine for collection '{collection_name}'")
    
    store = PGVector(
        embeddings=embedding_service,
        connection=engine,  # Pass engine instead of connection string
        collection_name=collection_name,
        create_extension=False,  # Extension already installed on Azure PostgreSQL
        async_mode=False,  # Force sync mode
        use_jsonb=True,
    )
    
    return store


def reset_collection_cache():
    """
    Reset the collection initialization cache (useful for testing).
    """
    global _collection_initialized
    with _init_lock:
        _collection_initialized = {}
        logger.info("Collection initialization cache reset")
