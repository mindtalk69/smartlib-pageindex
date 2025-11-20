# SmartLib Streaming Pipeline Code Implementation

## 1. Stream Manager Module (`modules/stream_manager.py`)

```python
"""
Stream Manager Module
Handles stream token generation, validation, and lifecycle management via Redis.
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from uuid import uuid4

import redis
from flask import current_app

logger = logging.getLogger(__name__)

# Redis connection pool
_redis_pool = None

def get_redis_client():
    """Get Redis client with connection pooling."""
    global _redis_pool
    if _redis_pool is None:
        redis_url = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        _redis_pool = redis.from_url(
            redis_url,
            max_connections=20,
            retry_on_timeout=True,
            socket_timeout=5,
            socket_connect_timeout=5
        )
    return _redis_pool

class StreamManager:
    """Manages streaming tokens and lifecycle in Redis."""
    
    STREAM_TTL = 3600  # 1 hour
    CLEANUP_BATCH_SIZE = 100
    
    @classmethod
    def generate_stream_token(cls, user_id: str, conversation_id: str) -> str:
        """Generate unique stream token and initialize Redis structures."""
        token = str(uuid4())
        redis_client = get_redis_client()
        
        # Initialize stream metadata
        metadata = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "initializing"
        }
        
        # Use pipeline for atomic operations
        pipe = redis_client.pipeline()
        pipe.hset(f"stream:{token}:metadata", mapping=metadata)
        pipe.expire(f"stream:{token}:metadata", cls.STREAM_TTL)
        pipe.set(f"stream:{token}:status", "initializing")
        pipe.expire(f"stream:{token}:status", cls.STREAM_TTL)
        pipe.execute()
        
        logger.info(f"Generated stream token {token} for user {user_id}")
        return token
    
    @classmethod
    def validate_stream_token(cls, token: str, user_id: str) -> bool:
        """Validate stream token and user access."""
        redis_client = get_redis_client()
        
        # Check if metadata exists
        if not redis_client.exists(f"stream:{token}:metadata"):
            return False
        
        # Get metadata and verify user
        metadata = redis_client.hgetall(f"stream:{token}:metadata")
        if not metadata or metadata.get("user_id") != user_id:
            return False
        
        # Check if stream is still active
        status = redis_client.get(f"stream:{token}:status")
        if status in ["completed", "error", "cancelled"]:
            return False
        
        return True
    
    @classmethod
    def update_stream_status(cls, token: str, status: str, error_msg: Optional[str] = None):
        """Update stream status in Redis."""
        redis_client = get_redis_client()
        
        pipe = redis_client.pipeline()
        pipe.set(f"stream:{token}:status", status)
        pipe.expire(f"stream:{token}:status", cls.STREAM_TTL)
        
        if error_msg:
            pipe.hset(f"stream:{token}:metadata", "error", error_msg)
        
        pipe.execute()
        
        logger.info(f"Updated stream {token} status to {status}")
    
    @classmethod
    def get_stream_status(cls, token: str) -> Optional[str]:
        """Get current stream status."""
        redis_client = get_redis_client()
        return redis_client.get(f"stream:{token}:status")
    
    @classmethod
    def publish_chunk(cls, token: str, chunk_data: Dict[str, Any]):
        """Publish streaming chunk to Redis."""
        redis_client = get_redis_client()
        
        chunk_json = json.dumps(chunk_data)
        pipe = redis_client.pipeline()
        pipe.rpush(f"stream:{token}", chunk_json)
        pipe.expire(f"stream:{token}", cls.STREAM_TTL)
        pipe.execute()
    
    @classmethod
    def get_chunks_since(cls, token: str, last_index: int = 0) -> list:
        """Get stream chunks since given index."""
        redis_client = get_redis_client()
        return redis_client.lrange(f"stream:{token}", last_index, -1)
    
    @classmethod
    def cleanup_stream(cls, token: str):
        """Clean up stream data from Redis."""
        redis_client = get_redis_client()
        
        pipe = redis_client.pipeline()
        pipe.delete(f"stream:{token}")
        pipe.delete(f"stream:{token}:metadata")
        pipe.delete(f"stream:{token}:status")
        pipe.execute()
        
        logger.info(f"Cleaned up stream {token}")
    
    @classmethod
    def cleanup_expired_streams(cls):
        """Clean up expired streams (background task)."""
        redis_client = get_redis_client()
        
        # Find all stream keys
        pattern = "stream:*:metadata"
        cursor = '0'
        expired_count = 0
        
        while cursor != 0:
            cursor, keys = redis_client.scan(
                cursor=cursor, 
                match=pattern, 
                count=cls.CLEANUP_BATCH_SIZE
            )
            
            for key in keys:
                # Check TTL
                ttl = redis_client.ttl(key)
                if ttl == -1:  # No TTL set, set it
                    redis_client.expire(key, cls.STREAM_TTL)
                    base_key = key.decode().replace(":metadata", "")
                    redis_client.expire(f"{base_key}", cls.STREAM_TTL)
                    redis_client.expire(f"{base_key}:status", cls.STREAM_TTL)
                elif ttl == -2:  # Key expired but not yet cleaned
                    expired_count += 1
            
            if expired_count > 0:
                logger.info(f"Found {expired_count} expired stream keys")
```

## 2. Enhanced Celery Tasks (`modules/agent_tasks.py`)

```python
"""
Enhanced Celery Tasks with Streaming Support
"""

import json
import logging
from typing import Any, Dict, List, Optional

from celery_app import celery
from modules.stream_manager import StreamManager
from modules.agent import invoke_agent_graph
from .agent_tasks import _deserialize_chat_history

logger = logging.getLogger(__name__)

@celery.task(name="modules.agent.invoke_agent_graph_stream")
def invoke_agent_graph_stream_task(
    query: str,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    vector_store_config: Optional[Dict[str, Any]] = None,
    stream_token: str = None,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    **kwargs: Any,
):
    """Enhanced agent task that streams responses via Redis."""
    
    if not stream_token:
        logger.error("Stream token not provided for streaming task")
        return {"type": "error", "message": "Stream token required"}
    
    try:
        # Update status to processing
        StreamManager.update_stream_status(stream_token, "processing")
        
        # Create Redis stream handler
        def redis_stream_handler(chunk_event):
            """Handle streaming chunks by publishing to Redis."""
            StreamManager.publish_chunk(stream_token, chunk_event)
            
            # Update status for special events
            chunk_type = chunk_event.get("type")
            if chunk_type == "end_of_stream":
                StreamManager.update_stream_status(stream_token, "completed")
            elif chunk_type == "error":
                StreamManager.update_stream_status(
                    stream_token, 
                    "error", 
                    chunk_event.get("message", "Unknown error")
                )
        
        # Deserialize chat history
        chat_history_messages = _deserialize_chat_history(chat_history)
        
        # Invoke agent graph with Redis stream handler
        return invoke_agent_graph(
            query=query,
            chat_history=chat_history_messages,
            vector_store_config=vector_store_config or {},
            stream=True,
            stream_handler=redis_stream_handler,
            image_base64=image_base64,
            image_mime_type=image_mime_type,
            uploaded_file_content=uploaded_file_content,
            uploaded_file_type=uploaded_file_type,
            uploaded_file_name=uploaded_file_name,
            conversation_id=conversation_id,
            **kwargs,
        )
        
    except Exception as e:
        logger.error(f"Error in streaming task {stream_token}: {e}", exc_info=True)
        
        # Publish error to Redis
        error_event = {
            "type": "error",
            "message": str(e),
            "status_code": 500,
            "stream_token": stream_token
        }
        StreamManager.publish_chunk(stream_token, error_event)
        StreamManager.update_stream_status(stream_token, "error", str(e))
        
        return {"type": "error", "message": str(e)}

@celery.task(name="modules.stream.cleanup")
def cleanup_expired_streams_task():
    """Background task to clean up expired streams."""
    try:
        StreamManager.cleanup_expired_streams()
        logger.info("Completed expired streams cleanup")
    except Exception as e:
        logger.error(f"Error during stream cleanup: {e}", exc_info=True)

# Configure periodic cleanup
from celery.schedules import crontab
celery.conf.beat_schedule = {
    'cleanup-expired-streams': {
        'task': 'modules.stream.cleanup',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}
```

## 3. Modified Agent Graph (`modules/agent.py`)

```python
# Add to invoke_agent_graph function signature and implementation

def invoke_agent_graph(
    query: str,
    chat_history: List[BaseMessage],
    vector_store_config: dict,
    stream: bool = False,
    stream_handler: Optional[Callable] = None,  # NEW: Custom stream handler
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    **kwargs
):
    """Invokes supervisor agent graph, handling streaming, HIL resumption, and normal queries."""
    # ... existing code ...
    
    if stream:
        print("--- Invoking SUPERVISOR graph in STREAMING mode ---")
        try:
            streaming_config = config.copy()
            streaming_config.pop("interrupt_before", None)
            
            if stream_handler:
                # Use custom stream handler (Redis)
                return _collect_stream_chunks_with_handler(
                    graph_to_invoke, initial_state, streaming_config, stream_handler
                )
            else:
                # Default behavior (direct streaming)
                return _collect_stream_chunks(graph_to_invoke, initial_state, streaming_config)
        except Exception as e:
            logging.error(f"Error during agent streaming: {e}", exc_info=True)
            return {"type": "error", "message": str(e), "conversation_id": current_thread_id}
    
    # ... rest of existing code ...

# New function to handle custom stream handlers
async def _collect_stream_chunks_with_handler(graph, inputs, config, stream_handler):
    """Helper to collect chunks from async stream and send to custom handler."""
    
    # Initialize with metadata
    configurable_values = config.get("configurable", {}) if config else {}
    db_message_id_from_config = configurable_values.get("db_message_id")
    thread_id_from_config = configurable_values.get("thread_id")
    
    if thread_id_from_config:
        metadata_packet = {
            "type": "metadata_update",
            "metadata": {
                "conversation_id": str(thread_id_from_config),
                "message_id": str(db_message_id_from_config) if db_message_id_from_config else None,
            },
        }
        stream_handler(metadata_packet)
    
    try:
        async for chunk_event in graph.astream_events(inputs, config=config, version="v1"):
            kind = chunk_event["event"]
            
            if kind == "on_chat_model_stream":
                raw_content = chunk_event["data"]["chunk"].content
                if raw_content:
                    # Sanitize content (reuse existing logic)
                    sanitized_content = _sanitize_stream_chunk(raw_content)
                    if sanitized_content:
                        chunk = {
                            'type': 'text_chunk', 
                            'content': sanitized_content
                        }
                        stream_handler(chunk)
            
            elif kind == "on_tool_end":
                tool_name = chunk_event.get("name")
                tool_output = chunk_event["data"].get("output")
                
                # Handle special tool outputs (maps, charts, etc.)
                if tool_name in ["generate_map_link", "generate_map_link_by_string_coordinates"] and isinstance(tool_output, dict):
                    chunk = {
                        'type': 'map_update',
                        'map_image_base64': tool_output.get('map_image_base64'),
                        'map_image_mime_type': tool_output.get('map_image_mime_type'),
                        'html_map_url': tool_output.get('html_map_url'),
                        'map_link': tool_output.get('map_link')
                    }
                    stream_handler(chunk)
            
            elif kind == "end":
                # Stream completed
                final_state = chunk_event.get("data", {})
                agent_output = final_state.get("agent_output", {})
                
                final_chunk = {
                    "type": "end_of_stream",
                    "data": {
                        "answer": agent_output.get("answer"),
                        "citations": agent_output.get("citations", []),
                        "suggested_questions": agent_output.get("suggested_questions", []),
                        "structured_query": agent_output.get("structured_query"),
                        "usage_metadata": final_state.get("current_turn_usage_metadata", {}),
                        "conversation_id": str(thread_id_from_config) if thread_id_from_config else None,
                        "message_id": str(db_message_id_from_config) if db_message_id_from_config else None,
                    }
                }
                stream_handler(final_chunk)
                return
                
    except Exception as e:
        error_chunk = {
            "type": "error",
            "message": str(e),
            "status_code": 500
        }
        stream_handler(error_chunk)
```

## 4. Modified Query Endpoint (`modules/query.py`)

```python
# Add to imports
from modules.stream_manager import StreamManager
from modules.celery_tasks import invoke_agent_graph_stream_task

# Modify the api_query function

@app.route('/api/query', methods=['GET', 'POST'])
def api_query():
    # ... existing validation code ...
    
    if stream_flag:
        # Generate stream token
        stream_token = StreamManager.generate_stream_token(
            current_user.user_id, 
            conversation_id
        )
        
        # Submit streaming task to Celery
        try:
            task = invoke_agent_graph_stream_task.delay(
                query=query_text,
                chat_history=_serialize_chat_history(chat_history_messages),
                vector_store_config=vector_store_config,
                stream_token=stream_token,
                image_base64=image_base64,
                image_mime_type=image_mime_type,
                uploaded_file_content=uploaded_file_content,
                uploaded_file_type=uploaded_file_type,
                uploaded_file_name=uploaded_file_name,
                conversation_id=conversation_id,
                user_id=current_user.user_id,
                db_message_id_for_stream=db_message_id_for_stream,
                user_id_for_stream=current_user.user_id,
            )
            
            logger.info(f"Submitted streaming task {task.id} with token {stream_token}")
            
        except Exception as e:
            logger.error(f"Failed to submit streaming task: {e}", exc_info=True)
            StreamManager.cleanup_stream(stream_token)
            return jsonify({
                "error": "Failed to start streaming task",
                "message": str(e)
            }), 500
        
        # Return SSE response that relays from Redis
        return Response(
            stream_with_context(stream_from_redis(stream_token, current_user.user_id)),
            status=200,
            headers={
                "Content-Type": "text/event-stream",
                "X-Stream-Token": stream_token,
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control"
            },
            mimetype="text/event-stream",
        )
    
    # ... non-streaming path remains unchanged ...

def stream_from_redis(stream_token: str, user_id: str):
    """Generator that relays Redis stream chunks to SSE."""
    
    # Validate stream token
    if not StreamManager.validate_stream_token(stream_token, user_id):
        error_event = {
            "type": "error",
            "message": "Invalid or expired stream token",
            "status_code": 401
        }
        yield f"data: {json.dumps(error_event)}\n\n"
        return
    
    # Update status to streaming
    StreamManager.update_stream_status(stream_token, "streaming")
    
    try:
        last_index = 0
        heartbeat_counter = 0
        
        while True:
            # Get new chunks from Redis
            chunks = StreamManager.get_chunks_since(stream_token, last_index)
            
            if chunks:
                for chunk in chunks:
                    try:
                        chunk_data = json.loads(chunk)
                        yield f"data: {chunk}\n\n"
                        last_index += 1
                        
                        # Check for end of stream
                        if chunk_data.get("type") == "end_of_stream":
                            logger.info(f"Stream {stream_token} completed successfully")
                            return
                            
                        # Check for error
                        if chunk_data.get("type") == "error":
                            logger.error(f"Stream {stream_token} encountered error")
                            return
                            
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON in stream chunk: {e}")
                        continue
            else:
                # No new chunks, send heartbeat
                heartbeat_counter += 1
                if heartbeat_counter % 30 == 0:  # Every 3 seconds (assuming 0.1s loop)
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            
            # Check stream status
            status = StreamManager.get_stream_status(stream_token)
            if status in ["completed", "error", "cancelled"]:
                logger.info(f"Stream {stream_token} ended with status: {status}")
                break
                
            # Small delay to prevent busy loop
            time.sleep(0.1)
            
    except GeneratorExit:
        # Client disconnected
        logger.info(f"Client disconnected from stream {stream_token}")
        StreamManager.update_stream_status(stream_token, "cancelled")
    except Exception as e:
        logger.error(f"Error in stream_from_redis: {e}", exc_info=True)
        error_event = {
            "type": "error",
            "message": "Stream relay error",
            "status_code": 500
        }
        yield f"data: {json.dumps(error_event)}\n\n"
    finally:
        # Schedule cleanup after delay
        StreamManager.cleanup_stream(stream_token)

def _serialize_error_event(message: str, status_code: int = 500) -> str:
    """Serialize error event for SSE."""
    error_event = {
        "type": "error",
        "message": message,
        "status_code": status_code
    }
    return f"data: {json.dumps(error_event)}\n\n"
```

## 5. Redis Configuration

### Docker Compose Addition
```yaml
# Add to docker-compose.yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
```

### Environment Variables
```bash
# Add to .env
REDIS_URL=redis://redis:6379/0
STREAM_TTL=3600
STREAM_CLEANUP_INTERVAL=300
MAX_CONCURRENT_STREAMS=100
```

## 6. Testing Implementation

### Test Script (`tests/test_streaming.py`)
```python
import pytest
import json
import time
from unittest.mock import Mock, patch
from modules.stream_manager import StreamManager
from modules.celery_tasks import invoke_agent_graph_stream_task

class TestStreamingPipeline:
    
    def test_stream_token_generation(self):
        """Test stream token generation and validation."""
        user_id = "test_user"
        conversation_id = "test_conv"
        
        # Generate token
        token = StreamManager.generate_stream_token(user_id, conversation_id)
        
        assert token is not None
        assert len(token) == 36  # UUID length
        
        # Validate token
        assert StreamManager.validate_stream_token(token, user_id) is True
        assert StreamManager.validate_stream_token(token, "wrong_user") is False
    
    def test_stream_status_updates(self):
        """Test stream status lifecycle."""
        token = StreamManager.generate_stream_token("user", "conv")
        
        # Initial status
        assert StreamManager.get_stream_status(token) == "initializing"
        
        # Update to processing
        StreamManager.update_stream_status(token, "processing")
        assert StreamManager.get_stream_status(token) == "processing"
        
        # Update to completed
        StreamManager.update_stream_status(token, "completed")
        assert StreamManager.get_stream_status(token) == "completed"
    
    @patch('modules.agent.invoke_agent_graph')
    def test_streaming_task(self, mock_invoke):
        """Test Celery streaming task."""
        # Mock the agent graph to return a result
        mock_invoke.return_value = {"answer": "Test response"}
        
        # Create test data
        stream_token = "test_token"
        query = "Test query"
        chat_history = []
        
        # Execute task
        result = invoke_agent_graph_stream_task(
            query=query,
            chat_history=chat_history,
            stream_token=stream_token,
            conversation_id="test_conv",
            user_id="test_user"
        )
        
        # Verify agent was called with stream handler
        mock_invoke.assert_called_once()
        call_args = mock_invoke.call_args
        assert call_args[1]['stream'] is True
        assert 'stream_handler' in call_args[1]
    
    def test_chunk_publishing(self):
        """Test Redis chunk publishing."""
        token = StreamManager.generate_stream_token("user", "conv")
        
        # Publish test chunk
        chunk_data = {"type": "text_chunk", "content": "Hello"}
        StreamManager.publish_chunk(token, chunk_data)
        
        # Retrieve chunks
        chunks = StreamManager.get_chunks_since(token)
        assert len(chunks) == 1
        
        retrieved_chunk = json.loads(chunks[0])
        assert retrieved_chunk['type'] == "text_chunk"
        assert retrieved_chunk['content'] == "Hello"
```

## 7. Monitoring and Observability

### Stream Metrics
```python
# Add to modules/stream_manager.py
class StreamMetrics:
    """Collect and report streaming metrics."""
    
    @classmethod
    def get_active_streams_count(cls):
        """Get count of currently active streams."""
        redis_client = get_redis_client()
        pattern = "stream:*:status"
        cursor = '0'
        active_count = 0
        
        while cursor != 0:
            cursor, keys = redis_client.scan(cursor=cursor, match=pattern, count=100)
            for key in keys:
                status = redis_client.get(key)
                if status in ["processing", "streaming"]:
                    active_count += 1
        
        return active_count
    
    @classmethod
    def get_stream_metrics(cls):
        """Get comprehensive stream metrics."""
        redis_client = get_redis_client()
        
        metrics = {
            "active_streams": cls.get_active_streams_count(),
            "redis_memory_usage": redis_client.info_memory().get("used_memory_human"),
            "total_streams": 0,
            "completed_streams": 0,
            "error_streams": 0,
            "cancelled_streams": 0
        }
        
        # Count by status
        pattern = "stream:*:status"
        cursor = '0'
        while cursor != 0:
            cursor, keys = redis_client.scan(cursor=cursor, match=pattern, count=100)
            for key in keys:
                status = redis_client.get(key)
                metrics["total_streams"] += 1
                
                if status == "completed":
                    metrics["completed_streams"] += 1
                elif status == "error":
                    metrics["error_streams"] += 1
                elif status == "cancelled":
                    metrics["cancelled_streams"] += 1
        
        return metrics
```

This implementation provides a complete Redis-backed streaming pipeline that distributes load between web and worker containers while maintaining backward compatibility with the existing non-streaming path.