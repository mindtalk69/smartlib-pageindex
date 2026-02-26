from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import Dict, Any

from database_fastapi import get_db
from modules.models import User, MessageHistory
from modules.auth import get_current_user
from schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/message", tags=["feedback"])


@router.post("/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> FeedbackResponse:
    """Submit thumbs up/down feedback for a message"""
    # Get the message
    message = db.exec(
        select(MessageHistory).where(
            MessageHistory.message_id == request.message_id
        ).limit(1)
    ).first()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Verify user owns this message
    if message.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to feedback on this message"
        )

    # Parse current feedback
    feedback_data = {}
    if message.feedback:
        try:
            feedback_data = eval(message.feedback)
        except:
            feedback_data = {}

    # Update or add feedback
    feedback_data[current_user.user_id] = request.feedback_type

    # Update message with new feedback
    message.feedback = str(feedback_data)

    # Recalculate counts
    like_count = sum(1 for v in feedback_data.values() if v == "like")
    dislike_count = sum(1 for v in feedback_data.values() if v == "dislike")

    db.commit()

    return FeedbackResponse(
        success=True,
        like_count=like_count,
        dislike_count=dislike_count
    )


@router.get("/metadata")
async def get_message_metadata(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get message metadata including citations, suggested questions, etc."""
    # Get the message
    message = db.exec(
        select(MessageHistory).where(
            MessageHistory.message_id == message_id
        ).limit(1)
    ).first()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Verify user owns this message
    if message.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this message"
        )

    # Parse metadata fields
    metadata = {}

    if message.citations:
        try:
            metadata["citations"] = eval(message.citations)
        except:
            metadata["citations"] = []

    if message.suggested_questions:
        try:
            metadata["suggested_questions"] = eval(message.suggested_questions)
        except:
            metadata["suggested_questions"] = []

    if message.metadata:
        try:
            metadata.update(eval(message.metadata))
        except:
            pass

    metadata.update({
        "message_id": message.message_id,
        "thread_id": message.thread_id,
        "timestamp": message.timestamp.isoformat(),
        "feedback": eval(message.feedback) if message.feedback else {}
    })

    return metadata
