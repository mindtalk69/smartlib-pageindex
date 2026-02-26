from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, AsyncGenerator
import json
import uuid
from datetime import datetime
import logging

from database_fastapi import get_db
from modules.models import (
    User, MessageHistory, VisualGroundingActivity, LibraryReference, VectorReference,
    UserGroup, Document
)
from modules.auth import get_current_user
from modules.celery_tasks import invoke_agent_via_worker, resume_agent_via_worker
from modules.access_control import filter_accessible_knowledges, knowledge_is_accessible
from schemas import Message
from modules.llm_utils import get_llm
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])
security = HTTPBearer()


# Schema definitions for query endpoints
class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User query")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    thread_id: Optional[str] = Field(None, description="Thread ID")
    library_id: Optional[int] = Field(None, description="Library ID")
    knowledge_id: Optional[int] = Field(None, description="Knowledge ID")
    stream: bool = Field(True, description="Enable streaming response")
    messages: List[Message] = Field(default=[], description="Previous messages")
    user: Optional[Dict[str, Any]] = Field(default={}, description="User info")


class ResumeRequest(BaseModel):
    thread_id: str = Field(..., description="Thread ID to resume")
    action: str = Field(..., description="Action to perform (web_search)")
    confirmed: bool = Field(..., description="Whether to confirm the action")


class WebSearchConfirmRequest(BaseModel):
    thread_id: str = Field(..., description="Thread ID")
    confirmed: bool = Field(..., description="Whether to confirm web search")


async def generate_sse_stream(
    request_data: Dict[str, Any],
    db: Session,
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AsyncGenerator[str, None]:
    """Generate SSE stream for RAG query response"""
    thread_id = request_data.get("thread_id", str(uuid.uuid4()))
    query = request_data.get("query", "")
    conversation_id = request_data.get("conversation_id", thread_id)
    library_id = request_data.get("library_id")
    knowledge_id = request_data.get("knowledge_id")
    messages = request_data.get("messages", [])
    user_info = request_data.get("user", {})

    # Verify JWT token matches user_id
    if credentials.credentials:
        try:
            # Try to decode JWT to verify user matches
            from modules.auth import verify_jwt_token
            jwt_payload = verify_jwt_token(credentials.credentials)
            if jwt_payload.get("sub") != user_id:
                yield f"data: {json.dumps({'type': 'error', 'content': 'User mismatch'})}\n\n"
                yield "data: [DONE]\n\n"
                return
        except Exception as e:
            logger.error(f"JWT verification failed: {e}")

    # Send initial status
    yield f"data: {json.dumps({'type': 'status', 'content': 'processing'})}\n\n"

    try:
        # Validate inputs
        if not query.strip():
            yield f"data: {json.dumps({'type': 'error', 'content': 'Query cannot be empty'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Build messages for agent
        agent_messages = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                agent_messages.append({"type": "human", "content": content})
            elif role == "assistant":
                agent_messages.append({"type": "ai", "content": content})

        # Add current query
        agent_messages.append({"type": "human", "content": query})

        # Prepare request for Celery worker
        worker_request = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "thread_id": thread_id,
            "query": query,
            "messages": agent_messages,
            "library_id": library_id,
            "knowledge_id": knowledge_id,
            "user_info": user_info
        }

        # Initialize message record
        db_message = MessageHistory(
            user_id=user_id,
            conversation_id=conversation_id,
            thread_id=thread_id,
            message=query,
            role="user",
            metadata={"streaming": True}
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        # Stream response from worker
        async for event in invoke_agent_via_worker(worker_request):
            yield f"data: {json.dumps(event)}\n\n"

        # Send DONE signal
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"Query processing error: {e}")
        error_data = {
            'type': 'error',
            'content': f'Error processing query: {str(e)}'
        }
        yield f"data: {json.dumps(error_data)}\n\n"
        yield "data: [DONE]\n\n"


@router.post("")
async def query_endpoint(
    request: QueryRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """RAG query endpoint with SSE streaming"""
    # Get current user
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Convert to dict for processing
    request_data = request.model_dump()

    return StreamingResponse(
        generate_sse_stream(request_data, db, str(user.id), credentials),
        media_type="text/event-stream"
    )


@router.post("/resume_rag")
async def resume_rag_endpoint(
    request: ResumeRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Resume RAG agent session"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Convert to dict
    request_data = request.model_dump()

    return StreamingResponse(
        generate_sse_stream(request_data, db, str(user.id), credentials),
        media_type="text/event-stream"
    )


@router.post("/confirm_web_search")
async def confirm_web_search_endpoint(
    request: WebSearchConfirmRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Confirm web search action"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Prepare request for worker
    worker_request = {
        "user_id": str(user.id),
        "thread_id": request.thread_id,
        "confirmed": request.confirmed,
        "action": "web_search"
    }

    return StreamingResponse(
        generate_sse_stream(worker_request, db, str(user.id), None),
        media_type="text/event-stream"
    )