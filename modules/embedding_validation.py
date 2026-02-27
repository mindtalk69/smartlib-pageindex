"""
Embedding dimension validation utilities.

This module provides functions to validate embedding model compatibility
and prevent dimension mismatches between documents and knowledge bases.
"""

import logging
import os
from typing import Optional, Tuple, Dict
from sqlmodel import select, Session
from database_fastapi import get_db
from modules.models import Knowledge, UploadedFile

logger = logging.getLogger(__name__)

# Embedding model dimensions mapping
EMBEDDING_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-ada-002": 1536,
    "Qwen/Qwen3-Embedding-0.6B": 1024,
    "BAAI/bge-m3": 1024,
    "BAAI/bge-large-en-v1.5": 1024,
    "BAAI/bge-base-en-v1.5": 768,
    "all-MiniLM-L6-v2": 384,
    "all-MiniLM-L12-v2": 384,
}


def get_embedding_model_dimension(model_name: str) -> Optional[int]:
    """
    Get the dimension for a given embedding model.

    Args:
        model_name: Name of the embedding model

    Returns:
        Dimension size or None if unknown
    """
    return EMBEDDING_DIMENSIONS.get(model_name)


def check_knowledge_embedding_dimension(knowledge_id: int) -> Optional[Tuple[str, int]]:
    """
    Check if a knowledge base has existing embeddings and return the model info.

    For PGVector: Queries the database to check for existing vectors
    For ChromaDB: Checks the knowledge's embedding_model field

    Args:
        knowledge_id: Knowledge base ID

    Returns:
        Tuple of (model_name, dimension) or None if no embeddings exist
    """
    db = next(get_db())
    try:
        knowledge = db.get(Knowledge, knowledge_id)
        if not knowledge:
            return None

        # Check if knowledge has an embedding_model set
        if knowledge.embedding_model:
            dimension = get_embedding_model_dimension(knowledge.embedding_model)
            if dimension:
                return (knowledge.embedding_model, dimension)

        # For backwards compatibility, check if there are any uploaded files
        # If there are files, assume embeddings exist
        statement = select(UploadedFile).where(UploadedFile.knowledge_id == knowledge_id)
        file_count = len(db.exec(statement).all())
        
        if file_count > 0:
            # Try to get current default model as fallback
            from modules.llm_utils import get_embedding_model_name
            current_model = get_embedding_model_name()
            dimension = get_embedding_model_dimension(current_model)
            if dimension:
                logger.warning(
                    f"Knowledge {knowledge_id} has {file_count} files but no embedding_model set. "
                    f"Assuming current model: {current_model} ({dimension}d)"
                )
                return (current_model, dimension)

        return None
    except Exception as e:
        logger.error(f"Error checking knowledge embedding dimension: {e}")
        return None
    finally:
        db.close()


def validate_embedding_compatibility(
    knowledge_id: int,
    new_model_name: str
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Validate if a new embedding model is compatible with existing embeddings.

    Args:
        knowledge_id: Knowledge base ID
        new_model_name: New embedding model name

    Returns:
        Tuple of (is_valid, message, info_dict)
        - is_valid: True if compatible
        - message: Human-readable message
        - info_dict: Dict with existing_model, existing_dim, new_dim
    """
    existing = check_knowledge_embedding_dimension(knowledge_id)

    # No existing embeddings - this is fine
    if existing is None:
        new_dim = get_embedding_model_dimension(new_model_name)
        return (
            True,
            f"Knowledge base has no existing embeddings. Will use {new_model_name} ({new_dim}d).",
            {"existing_model": None, "existing_dim": None, "new_dim": new_dim}
        )

    existing_model, existing_dim = existing
    new_dim = get_embedding_model_dimension(new_model_name)

    # Same dimensions - compatible
    if existing_dim == new_dim:
        return (
            True,
            f"Compatible: {new_model_name} has same dimensions ({new_dim}d) as existing embeddings ({existing_model}).",
            {"existing_model": existing_model, "existing_dim": existing_dim, "new_dim": new_dim}
        )

    # Different dimensions - incompatible
    return (
        False,
        f"INCOMPATIBLE: Cannot use {new_model_name} ({new_dim}d) with existing embeddings ({existing_model}, {existing_dim}d). "
        f"All documents in a knowledge base must use the same embedding dimensions. "
        f"Please re-index all documents or create a new knowledge base.",
        {"existing_model": existing_model, "existing_dim": existing_dim, "new_dim": new_dim}
    )


def get_all_knowledges_with_embeddings() -> Dict[int, Tuple[str, int]]:
    """
    Get all knowledge bases with their embedding model info.

    Returns:
        Dict mapping knowledge_id to (model_name, dimension)
    """
    result = {}
    db = next(get_db())
    try:
        knowledges = db.exec(select(Knowledge)).all()
        for knowledge in knowledges:
            if knowledge.embedding_model:
                dimension = get_embedding_model_dimension(knowledge.embedding_model)
                if dimension:
                    result[knowledge.id] = (knowledge.embedding_model, dimension)
            else:
                # Check if knowledge has files (backwards compatibility)
                statement = select(UploadedFile).where(UploadedFile.knowledge_id == knowledge.id)
                file_count = len(db.exec(statement).all())
                
                if file_count > 0:
                    # Assume current model
                    from modules.llm_utils import get_embedding_model_name
                    current_model = get_embedding_model_name()
                    dimension = get_embedding_model_dimension(current_model)
                    if dimension:
                        result[knowledge.id] = (current_model, dimension)
    except Exception as e:
        logger.error(f"Error getting knowledges with embeddings: {e}")
    finally:
        db.close()

    return result


def validate_global_embedding_model_change(new_model_name: str) -> Tuple[bool, str, list]:
    """
    Validate if changing the global default embedding model is safe.

    Checks all knowledge bases to see if any have incompatible embeddings.

    Args:
        new_model_name: New global default embedding model

    Returns:
        Tuple of (is_safe, message, affected_knowledges)
        - is_safe: True if change is safe for all knowledge bases
        - message: Human-readable summary
        - affected_knowledges: List of dicts with knowledge info
    """
    new_dim = get_embedding_model_dimension(new_model_name)
    if not new_dim:
        return (
            False,
            f"Unknown embedding model: {new_model_name}",
            []
        )

    knowledges = get_all_knowledges_with_embeddings()
    incompatible = []

    db = next(get_db())
    try:
        for knowledge_id, (existing_model, existing_dim) in knowledges.items():
            if existing_dim != new_dim:
                knowledge = db.get(Knowledge, knowledge_id)
                incompatible.append({
                    "id": knowledge_id,
                    "name": knowledge.name if knowledge else f"Knowledge {knowledge_id}",
                    "existing_model": existing_model,
                    "existing_dim": existing_dim,
                    "new_dim": new_dim
                })
    finally:
        db.close()

    if incompatible:
        count = len(incompatible)
        return (
            False,
            f"WARNING: Changing to {new_model_name} ({new_dim}d) will affect {count} knowledge base(s) "
            f"with different embedding dimensions. These knowledge bases will need to be re-indexed.",
            incompatible
        )

    return (
        True,
        f"Safe to change to {new_model_name} ({new_dim}d). All existing knowledge bases are compatible.",
        []
    )
