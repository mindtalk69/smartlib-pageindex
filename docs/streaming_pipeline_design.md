# SmartLib Celery Streaming Pipeline Design

## Overview

This document outlines the design for implementing a Redis-backed streaming bus that enables streaming responses to be processed through Celery workers, distributing load between web and worker containers.

## Current State Issues

1. **Load Imbalance**: Streaming calls bypass Celery and run directly in web container
2. **Resource Inefficiency**: Worker containers are underutilized during streaming requests
3. **Scalability Bottleneck**: Web container becomes a bottleneck for streaming traffic

## Proposed Architecture

### Components

1. **Stream Token Manager**
   - Generates unique stream tokens for each streaming request
   - Manages stream lifecycle and cleanup
   - Tracks active streams in Redis

2. **Redis Stream Bus**
   - `stream:{token}` - Redis list for streaming chunks
   - `stream:{token}:metadata` - Redis hash for stream metadata
   - `stream:{token}:status` - Redis key for stream status
   - TTL-based cleanup for completed/failed streams

3. **Worker Side Streaming**
   - Enhanced `invoke_agent_graph_task` to support streaming mode
   - Stream chunks published to Redis as they're generated
   - Status updates (started, completed, error) published to Redis

4. **Web Side SSE Relay**
   - Subscribes to Redis streams for active tokens
   - Relays chunks to client via Server-Sent Events (SSE)
   - Handles client disconnection and cleanup

### Data Flow

```
Client → Web Container → Celery Queue → Worker Container
                                    ↓
                            Redis Stream Bus
                                    ↓
Web Container SSE Relay ← Redis ← Worker Stream Emitter
                                    ↓
                              Client (SSE)
```

## Implementation Details

### 1. Stream Token Generation (Web Container)

```python
def generate_stream_token():
    """Generate unique stream token and initialize Redis structures."""
    token = str(uuid4())
    # Initialize Redis structures
    redis_client.setex(f"stream:{token}:status", 3600, "initializing")
    redis_client.hset(f"stream:{token}:metadata", mapping={
        "created_at": datetime.utcnow().isoformat(),
        "user_id": current_user.user_id,
        "conversation_id": conversation_id
    })
    redis_client.expire(f"stream:{token}:metadata", 3600)
    return token
```

### 2. Enhanced Celery Task (Worker Container)

```python
@celery.task(name="modules.agent.invoke_agent_graph_stream")
def invoke_agent_graph_stream_task(
    query: str,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    vector_store_config: Optional[Dict[str, Any]] = None,
    stream_token: str = None,
    # ... other parameters
):
    """Enhanced agent task that streams responses via Redis."""
    
    # Update status to "processing"
    redis_client.set(f"stream:{stream_token}:status", "processing")
    
    # Stream chunks to Redis
    async def stream_to_redis(chunk_event):
        chunk_data = json.dumps(chunk_event)
        redis_client.rpush(f"stream:{token}", chunk_data)
        redis_client.expire(f"stream:{token}", 3600)
    
    # Modified invoke_agent_graph with custom stream handler
    return invoke_agent_graph(
        query=query,
        chat_history=chat_history_messages,
        vector_store_config=vector_store_config or {},
        stream=True,
        stream_handler=stream_to_redis,
        **kwargs,
    )
```

### 3. SSE Relay (Web Container)

```python
def stream_from_redis(stream_token: str):
    """Generator that relays Redis stream chunks to SSE."""
    
    # Check if stream exists and is accessible
    if not redis_client.exists(f"stream:{stream_token}:metadata"):
        yield _serialize_error_event("Invalid or expired stream token")
        return
    
    # Update status to "streaming"
    redis_client.set(f"stream:{stream_token}:status", "streaming")
    
    try:
        last_id = 0
        while True:
            # Read new chunks from Redis list
            chunks = redis_client.lrange(f"stream:{stream_token}", last_id, -1)
            
            for chunk in chunks:
                try:
                    chunk_data = json.loads(chunk)
                    if chunk_data.get("type") == "end_of_stream":
                        # Stream completed
                        redis_client.set(f"stream:{stream_token}:status", "completed")
                        yield f"data: {json.dumps(chunk_data)}\n\n"
                        return
                    else:
                        # Relay chunk to client
                        yield f"data: {chunk}\n\n"
                        last_id += 1
                except json.JSONDecodeError:
                    continue
            
            # Check stream status
            status = redis_client.get(f"stream:{stream_token}:status")
            if status in ["completed", "error", "cancelled"]:
                break
                
            # Small delay to prevent busy loop
            time.sleep(0.01)
            
    except GeneratorExit:
        # Client disconnected
        redis_client.set(f"stream:{stream_token}:status", "cancelled")
    finally:
        # Cleanup Redis after delay
        redis_client.expire(f"stream:{stream_token}", 60)
        redis_client.expire(f"stream:{stream_token}:metadata", 60)
        redis_client.expire(f"stream:{stream_token}:status", 60)
```

### 4. Modified Query Endpoint

```python
@app.route('/api/query', methods=['GET', 'POST'])
def api_query():
    # ... existing validation code ...
    
    if stream_flag:
        # Generate stream token
        stream_token = generate_stream_token()
        
        # Submit task to Celery with stream token
        task_id = submit_agent_task(
            query=query_text,
            stream_flag=True,
            stream_token=stream_token,
            # ... other parameters
        )
        
        # Return SSE response that relays from Redis
        return Response(
            stream_with_context(stream_from_redis(stream_token)),
            status=200,
            headers={
                "Content-Type": "text/event-stream",
                "X-Stream-Token": stream_token
            },
            mimetype="text/event-stream",
        )
    
    # ... non-streaming path remains unchanged ...
```

## Redis Key Structure

| Key Pattern | Type | Purpose | TTL |
|-------------|------|---------|-----|
| `stream:{token}` | List | Store streaming chunks | 1 hour |
| `stream:{token}:metadata` | Hash | Stream metadata (user_id, created_at) | 1 hour |
| `stream:{token}:status` | String | Stream status (initializing, processing, streaming, completed, error, cancelled) | 1 hour |

## Stream Status Flow

1. `initializing` - Token generated, Redis structures created
2. `processing` - Task picked up by worker, starting processing
3. `streaming` - Web container actively streaming to client
4. `completed` - Stream finished successfully
5. `error` - Stream failed due to error
6. `cancelled` - Client disconnected or stream cancelled

## Error Handling

1. **Worker Errors**: Error status set in Redis, error chunk published
2. **Client Disconnection**: Status set to `cancelled`, cleanup initiated
3. **Timeout**: Redis TTL automatically cleans up expired streams
4. **Invalid Token**: Immediate error response to client

## Benefits

1. **Load Distribution**: Streaming processing moved to worker containers
2. **Scalability**: Multiple workers can handle streaming in parallel
3. **Resilience**: Redis provides durable buffer between worker and web
4. **Backward Compatibility**: Non-streaming path unchanged
5. **Monitoring**: Stream status visible in Redis for observability

## Implementation Steps

1. Create stream management utilities (`modules/stream_manager.py`)
2. Enhance Celery tasks for streaming support
3. Implement SSE relay in web container
4. Update query endpoint to use new streaming pipeline
5. Add stream cleanup and monitoring
6. Test with various scenarios (success, error, disconnect)
7. Update documentation