"""
Celery task wrapper module for web container.
This module provides a safe interface to submit tasks without importing heavy dependencies.
"""

import logging
from typing import Any, Dict, List, Optional

from celery.exceptions import TimeoutError as CeleryTimeoutError
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

try:
    from celery_app import celery
    CELERY_AVAILABLE = True
    logger.info("Celery client available for task submission")
except ImportError as e:
    logger.warning(f"Celery client not available: {e}")
    celery = None
    CELERY_AVAILABLE = False

FILE_PROCESS_TASK = "modules.upload_processing.async_process_single_file"
AGENT_TASK = "modules.agent.invoke_agent_graph"
AGENT_STREAMING_TASK = "modules.agent.invoke_agent_graph_streaming"
DOCUMENT_CHUNKS_TASK = "modules.vector_tasks.fetch_document_chunks"
LIST_CHROMA_STORES_TASK = "modules.vector_tasks.list_chroma_stores"
DELETE_CHROMA_COLLECTION_TASK = "modules.vector_tasks.delete_chroma_collection"
RESUME_AGENT_TASK = "modules.agent.resume_agent_graph"


def _serialize_message(message: BaseMessage) -> Dict[str, Any]:
    content: Any = getattr(message, "content", "")
    if content is None:
        content = ""

    if isinstance(message, HumanMessage):
        msg_type = "human"
    elif isinstance(message, AIMessage):
        msg_type = "ai"
    elif isinstance(message, SystemMessage):
        msg_type = "system"
    else:
        msg_type = "human"

    return {"type": msg_type, "content": content}


def _serialize_chat_history(messages: Optional[List[BaseMessage]]) -> List[Dict[str, Any]]:
    if not messages:
        return []
    return [_serialize_message(msg) for msg in messages]

def _send_task_and_wait(task_name: str, payload: Dict[str, Any], timeout: Optional[float] = None) -> Any:
    if not CELERY_AVAILABLE or celery is None:
        logger.warning("Celery not available - cannot send task %s", task_name)
        return None

    try:
        task = celery.send_task(task_name, kwargs=payload)
        return task.get(timeout=timeout)
    except CeleryTimeoutError:
        logger.error("Celery task %s timed out after %s seconds", task_name, timeout)
        return None
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Celery task %s failed: %s", task_name, exc)
        return None


WORKER_HEARTBEAT_TASK = "celery_app.worker_heartbeat"


def wake_worker(timeout: float = 10.0) -> bool:
    """
    Wake up the worker by calling heartbeat task synchronously.
    This forces Azure App Service to wake up suspended worker pool processes.
    
    Args:
        timeout: Maximum seconds to wait for worker response
        
    Returns:
        True if worker responded, False otherwise
    """
    if not CELERY_AVAILABLE or celery is None:
        logger.warning("Celery not available - cannot wake worker")
        return False
    
    try:
        logger.info("[WakeWorker] Pinging worker to ensure it's active...")
        task = celery.send_task(WORKER_HEARTBEAT_TASK)
        result = task.get(timeout=timeout)
        logger.info(f"[WakeWorker] Worker responded: {result}")
        return True
    except CeleryTimeoutError:
        logger.warning(f"[WakeWorker] Worker did not respond within {timeout}s timeout")
        return False
    except Exception as exc:
        logger.warning(f"[WakeWorker] Failed to wake worker: {exc}")
        return False


def submit_file_processing_task(temp_file_path, filename, user_id, library_id, library_name, knowledge_id_str, enable_visual_grounding_flag, url_download_id=None, source_url=None, content_type=None):
    """
    Submit a file processing task to Celery worker.
    Returns task_id if successful, None if Celery is not available.
    """
    if not CELERY_AVAILABLE or celery is None:
        logger.warning("Celery not available - cannot submit task")
        return None

    # Wake up worker first to handle Azure App Service cold starts
    wake_worker(timeout=15.0)

    try:
        task = celery.send_task(
            FILE_PROCESS_TASK,
            kwargs={
                "temp_file_path_from_route": temp_file_path,
                "original_filename": filename,
                "user_id": user_id,
                "library_id": library_id,
                "library_name": library_name,
                "knowledge_id_str": knowledge_id_str,
                "enable_visual_grounding_flag": enable_visual_grounding_flag,
                "url_download_id": url_download_id,
                "source_url": source_url,
                "content_type": content_type,
            },
        )
        logger.info(f"Submitted Celery task {task.id} for processing {filename}")
        return task.id
    except Exception as e:
        logger.error(f"Failed to submit Celery task: {e}")
        return None

def submit_agent_task(query, stream_flag, config, user_id, library_id, knowledge_id):
    """
    Submit an agent query task to Celery worker.
    Returns task_id if successful, None if Celery is not available.
    """
    if not CELERY_AVAILABLE or celery is None:
        logger.warning("Celery not available - cannot submit agent task")
        return None

    try:
        task = celery.send_task(
            AGENT_TASK,
            kwargs={
                "query": query,
                "stream": stream_flag,
                "vector_store_config": config,
                "user_id": user_id,
                "library_id": library_id,
                "knowledge_id": knowledge_id,
            },
        )
        logger.info(f"Submitted agent task {task.id} for query preview '{query[:100]}...'")
        return task.id
    except Exception as e:
        logger.warning(
            f"Failed to queue agent task via Celery, falling back to sync mode: {e}"
        )
        return "sync_mode"


def invoke_agent_via_worker(
    query: str,
    chat_history: Optional[List[BaseMessage]],
    vector_store_config: Optional[Dict[str, Any]] = None,
    stream: bool = False,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    timeout: Optional[float] = None,
    extra_kwargs: Optional[Dict[str, Any]] = None,
) -> Any:
    payload: Dict[str, Any] = {
        "query": query,
        "chat_history": _serialize_chat_history(chat_history),
        "vector_store_config": vector_store_config or {},
        "stream": stream,
        "image_base64": image_base64,
        "image_mime_type": image_mime_type,
        "uploaded_file_content": uploaded_file_content,
        "uploaded_file_type": uploaded_file_type,
        "uploaded_file_name": uploaded_file_name,
        "conversation_id": conversation_id,
    }
    if extra_kwargs:
        payload.update(extra_kwargs)

    return _send_task_and_wait(AGENT_TASK, payload, timeout=timeout)


def resume_agent_via_worker(
    thread_id: str,
    confirmation: Optional[str] = None,
    stream: bool = False,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    conversation_id: Optional[str] = None,
    timeout: Optional[float] = None,
    extra_kwargs: Optional[Dict[str, Any]] = None,
) -> Any:
    payload: Dict[str, Any] = {
        "thread_id": thread_id,
        "confirmation": confirmation,
        "stream": stream,
        "image_base64": image_base64,
        "image_mime_type": image_mime_type,
        "conversation_id": conversation_id,
    }
    if extra_kwargs:
        payload.update(extra_kwargs)

    return _send_task_and_wait(RESUME_AGENT_TASK, payload, timeout=timeout)


def fetch_document_chunks(persist_directory: str, collection_name: str, document_id: str):
    """Fetch document chunks via worker task."""
    return _send_task_and_wait(
        DOCUMENT_CHUNKS_TASK,
        {
            "persist_directory": persist_directory,
            "collection_name": collection_name,
            "document_id": document_id,
        },
    )


def list_chroma_stores(base_path: str | None = None):
    """List local Chroma stores via worker task."""
    return _send_task_and_wait(
        LIST_CHROMA_STORES_TASK,
        {"base_path": base_path},
    )


def delete_chroma_collection_via_worker(persist_directory: str, collection_name: str) -> bool:
    """Delete a Chroma collection via worker task."""
    result = _send_task_and_wait(
        DELETE_CHROMA_COLLECTION_TASK,
        {
            "persist_directory": persist_directory,
            "collection_name": collection_name,
        },
    )
    return bool(result)


def offload_streaming_agent_task(
    stream_id: str,
    query: str,
    chat_history: Optional[List[BaseMessage]],
    vector_store_config: Optional[Dict[str, Any]] = None,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    extra_kwargs: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Fire-and-forget submission of a streaming agent task to Celery worker.
    The task will publish results to Redis stream identified by stream_id.

    Returns:
        task_id if successfully submitted, None if Celery unavailable
    """
    if not CELERY_AVAILABLE or celery is None:
        logger.warning("Celery not available - cannot offload streaming agent task")
        return None

    payload: Dict[str, Any] = {
        "stream_id": stream_id,
        "query": query,
        "chat_history": _serialize_chat_history(chat_history),
        "vector_store_config": vector_store_config or {},
        "image_base64": image_base64,
        "image_mime_type": image_mime_type,
        "uploaded_file_content": uploaded_file_content,
        "uploaded_file_type": uploaded_file_type,
        "uploaded_file_name": uploaded_file_name,
        "conversation_id": conversation_id,
    }
    if extra_kwargs:
        payload.update(extra_kwargs)

    try:
        task = celery.send_task(AGENT_STREAMING_TASK, kwargs=payload)
        logger.info(f"Offloaded streaming agent task {task.id} for stream_id={stream_id}")
        return task.id
    except Exception as exc:
        logger.error(f"Failed to offload streaming agent task: {exc}", exc_info=True)
        return None


