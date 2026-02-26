from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from typing import Dict, Any, Optional
import json

from database_fastapi import get_db
from modules.models import User, Document, Library
from modules.auth import get_current_user

router = APIRouter(tags=["documents"])
security = HTTPBearer()


@router.get("/document-meta")
async def get_document_metadata(
    document_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get document metadata"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Get document
    document = db.exec(
        select(Document).where(
            Document.document_id == document_id
        ).limit(1)
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Get associated library
    library = db.exec(
        select(Library).where(
            Library.library_id == document.library_id
        ).limit(1)
    ).first()

    # Return metadata
    return {
        "document_id": document.document_id,
        "metadata": {
            "filename": document.filename,
            "file_size": document.file_size,
            "content_type": document.content_type,
            "upload_time": document.upload_time.isoformat(),
            "library_id": document.library_id,
            "library_name": library.name if library else "Unknown",
            "chunk_count": document.chunk_count,
            "total_tokens": document.total_tokens
        }
    }


@router.get("/get-document-chunk")
async def get_document_chunk(
    doc_id: str,
    chunk_id: int,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get specific document chunk"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Get document
    document = db.exec(
        select(Document).where(
            Document.document_id == doc_id
        ).limit(1)
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify user has access to this document's library
    library = db.exec(
        select(Library).where(
            Library.library_id == document.library_id
        ).limit(1)
    ).first()

    if not library:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Library not found"
        )

    # For now, return mock chunk data
    # TODO: Implement actual chunk retrieval from vector store
    return {
        "content": f"Mock content for chunk {chunk_id} of document {doc_id}",
        "metadata": {
            "chunk_id": chunk_id,
            "document_id": doc_id,
            "file_name": document.filename,
            "chunk_token_count": 250
        }
    }


@router.get("/self-retriever-questions")
async def get_self_retriever_questions(
    knowledge_id: int,
    library_id: int,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Generate suggested questions for context"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Verify permissions
    library = db.exec(
        select(Library).where(
            Library.library_id == library_id
        ).limit(1)
    ).first()

    if not library:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Library not found"
        )

    # Return mock questions
    # TODO: Implement actual question generation using LLM
    return {
        "questions": [
            "What are the main features of this product?",
            "How do I install the software?",
            "Where can I find troubleshooting information?",
            "What are the system requirements?",
            "How do I contact support?"
        ]
    }