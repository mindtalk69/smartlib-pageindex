import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from celery_app import celery
from flask import current_app
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from extensions import db
from modules.agent import invoke_agent_graph, resume_agent_graph
from modules.database import MessageFeedback, MessageHistory
from modules.map_utils import purge_map_assets

logger = logging.getLogger(__name__)


def _deserialize_message(payload: Dict[str, Any]) -> BaseMessage:
    """Rebuild a LangChain message object from its serialized form."""
    msg_type = payload.get("type")
    content = payload.get("content")
    if content is None:
        content = ""

    if msg_type == "human":
        return HumanMessage(content=content)
    if msg_type == "ai":
        return AIMessage(content=content)
    if msg_type == "system":
        return SystemMessage(content=content)

    logger.debug("Unknown message type '%s' received; defaulting to HumanMessage", msg_type)
    return HumanMessage(content=content)


def _deserialize_chat_history(serialized: Optional[Iterable[Dict[str, Any]]]) -> List[BaseMessage]:
    if not serialized:
        return []
    messages: List[BaseMessage] = []
    for item in serialized:
        try:
            messages.append(_deserialize_message(item))
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to deserialize chat history item %s: %s", item, exc)
    return messages


@celery.task(name="modules.agent.invoke_agent_graph")
def invoke_agent_graph_task(
    query: str,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    vector_store_config: Optional[Dict[str, Any]] = None,
    stream: bool = False,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    **kwargs: Any,
) -> Any:
    if stream:
        logger.info("Streaming mode requested via Celery; falling back to non-streaming execution.")
        stream = False

    chat_history_messages = _deserialize_chat_history(chat_history)
    return invoke_agent_graph(
        query=query,
        chat_history=chat_history_messages,
        vector_store_config=vector_store_config or {},
        stream=stream,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
        uploaded_file_content=uploaded_file_content,
        uploaded_file_type=uploaded_file_type,
        uploaded_file_name=uploaded_file_name,
        conversation_id=conversation_id,
        **kwargs,
    )


@celery.task(name="modules.agent.resume_agent_graph")
def resume_agent_graph_task(
    thread_id: str,
    confirmation: Optional[str] = None,
    stream: bool = False,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    conversation_id: Optional[str] = None,
    **kwargs: Any,
) -> Any:
    if stream:
        logger.info("Streaming resume requested via Celery; falling back to non-streaming execution.")
        stream = False

    return resume_agent_graph(
        thread_id=thread_id,
        confirmation=confirmation,
        stream=stream,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
        conversation_id=conversation_id,
        **kwargs,
    )


@celery.task(name="modules.agent.cleanup_generated_maps")
def cleanup_generated_maps_task(max_age_hours: Optional[int] = None) -> Dict[str, Any]:
    app_config = current_app.config
    if not app_config.get('MAP_RETENTION_ENABLED', True):
        logger.debug("Map retention disabled; skipping cleanup task.")
        return {"removed": 0, "retention_hours": None, "base_dir": None}

    base_dir = Path(app_config.get('MAP_PUBLIC_DIR', Path(current_app.root_path) / 'static' / 'maps'))
    retention_hours = max_age_hours or app_config.get('MAP_RETENTION_HOURS', 24)

    removed = purge_map_assets(base_dir, retention_hours, logger=logger)
    if removed:
        logger.info("Removed %s generated map files older than %s hours from %s", removed, retention_hours, base_dir)
    else:
        logger.debug("No generated map files older than %s hours found in %s", retention_hours, base_dir)

    return {
        "removed": removed,
        "retention_hours": retention_hours,
        "base_dir": str(base_dir),
    }


@celery.task(name="modules.agent.cleanup_message_history")
def cleanup_message_history_task(retention_days: Optional[int] = None) -> Dict[str, Any]:
    app_config = current_app.config
    if not app_config.get('MESSAGE_RETENTION_ENABLED', True):
        logger.debug("Message retention disabled; skipping cleanup task.")
        return {"removed": 0, "retention_days": None}

    days = retention_days or app_config.get('MESSAGE_RETENTION_DAYS', 30)
    if days <= 0:
        logger.debug("Message retention configured with non-positive days (%s); skipping.", days)
        return {"removed": 0, "retention_days": days}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logger.debug("Cleaning up message history prior to %s", cutoff.isoformat())

    try:
        subquery = db.session.query(MessageHistory.message_id).filter(MessageHistory.timestamp < cutoff).subquery()

        feedback_deleted = db.session.query(MessageFeedback).filter(MessageFeedback.message_id.in_(subquery)).delete(synchronize_session=False)
        messages_deleted = db.session.query(MessageHistory).filter(MessageHistory.timestamp < cutoff).delete(synchronize_session=False)
        db.session.commit()
        if messages_deleted:
            logger.info("Deleted %s messages and %s feedback entries older than %s days.", messages_deleted, feedback_deleted, days)
        else:
            logger.debug("No messages older than %s days found for cleanup.", days)
        return {
            "removed": messages_deleted,
            "feedback_removed": feedback_deleted,
            "retention_days": days,
        }
    except Exception as exc:
        db.session.rollback()
        logger.error("Message history cleanup failed: %s", exc, exc_info=True)
        return {"removed": 0, "feedback_removed": 0, "retention_days": days, "error": str(exc)}
