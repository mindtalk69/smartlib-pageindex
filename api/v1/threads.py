from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
import json

from database_fastapi import get_db
from modules.models import User, MessageHistory
from modules.auth import get_current_user
from schemas import ThreadInfo, MessageHistoryRead

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("")
async def list_threads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's conversation threads"""
    # Get all threads for this user
    statement = select(MessageHistory).where(
        MessageHistory.user_id == current_user.user_id
    ).distinct(MessageHistory.thread_id).order_by(MessageHistory.timestamp.desc())
    threads = db.exec(statement).all()

    thread_list = []
    for thread in threads:
        # Get thread details (first message as preview)
        first_msg = db.exec(
            select(MessageHistory).where(
                MessageHistory.thread_id == thread.thread_id,
                MessageHistory.user_id == current_user.user_id
            ).order_by(MessageHistory.timestamp.asc()).limit(1)
        ).first()

        if first_msg:
            thread_list.append(ThreadInfo(
                id=thread.thread_id,
                preview=first_msg.message[:50] + "..." if len(first_msg.message) > 50 else first_msg.message,
                lastUpdated=first_msg.timestamp.isoformat(),
                messageCount=db.exec(
                    select(MessageHistory).where(
                        MessageHistory.thread_id == thread.thread_id,
                        MessageHistory.user_id == current_user.user_id
                    )
                ).count()
            ))

    return thread_list


@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get thread details"""
    # Verify user owns this thread
    thread_exists = db.exec(
        select(MessageHistory).where(
            MessageHistory.thread_id == thread_id,
            MessageHistory.user_id == current_user.user_id
        ).limit(1)
    ).first()

    if not thread_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )

    return {"thread_id": thread_id, "user_id": current_user.user_id}


@router.delete("/{thread_id}")
async def delete_thread(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete conversation thread"""
    # Verify user owns this thread
    thread_exists = db.exec(
        select(MessageHistory).where(
            MessageHistory.thread_id == thread_id,
            MessageHistory.user_id == current_user.user_id
        ).limit(1)
    ).first()

    if not thread_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )

    # Delete all messages in this thread
    statement = select(MessageHistory).where(
        MessageHistory.thread_id == thread_id,
        MessageHistory.user_id == current_user.user_id
    )
    messages = db.exec(statement).all()

    for message in messages:
        db.delete(message)

    db.commit()

    return {"success": True, "message": "Thread deleted successfully"}


@router.get("/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages in a thread"""
    # Verify user owns this thread
    thread_exists = db.exec(
        select(MessageHistory).where(
            MessageHistory.thread_id == thread_id,
            MessageHistory.user_id == current_user.user_id
        ).limit(1)
    ).first()

    if not thread_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )

    # Get all messages in thread
    statement = select(MessageHistory).where(
        MessageHistory.thread_id == thread_id,
        MessageHistory.user_id == current_user.user_id
    ).order_by(MessageHistory.timestamp.asc())
    messages = db.exec(statement).all()

    # Convert to response format
    message_list = []
    for msg in messages:
        message_list.append(MessageHistoryRead(
            message_id=msg.message_id,
            user_id=msg.user_id,
            thread_id=msg.thread_id,
            message_text=msg.message,
            answer=msg.answer,
            timestamp=msg.timestamp,
            citations=json.loads(msg.citations) if msg.citations else [],
            suggested_questions=json.loads(msg.suggested_questions) if msg.suggested_questions else []
        ))

    return message_list
