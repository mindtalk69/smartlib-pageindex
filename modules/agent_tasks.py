import logging
from typing import Any, Dict, Iterable, List, Optional

from celery_app import celery
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from modules.agent import invoke_agent_graph, resume_agent_graph

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
