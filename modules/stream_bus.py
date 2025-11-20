"""Redis-backed stream bus helpers for coordinating SSE relays."""

from __future__ import annotations

import os
from typing import Generator, Optional

import redis
from flask import current_app

STREAM_CLOSE_SENTINEL = "__STREAM_CLOSE__"


class RedisStreamBus:
    """Small helper around a Redis list used as a streaming queue."""

    def __init__(
        self,
        *,
        url: Optional[str] = None,
        prefix: Optional[str] = None,
        ttl: Optional[int] = None,
        block_timeout: Optional[int] = None,
    ) -> None:
        config = getattr(current_app, "config", {})
        resolved_url = (
            url
            or config.get("STREAM_BUS_URL")
            or os.environ.get("STREAM_BUS_URL")
            or config.get("CELERY_BROKER_URL")
            or os.environ.get("CELERY_BROKER_URL")
            or "redis://localhost:6379/0"
        )
        self.url = resolved_url
        self.prefix = prefix or config.get("STREAM_QUEUE_PREFIX", "smartlib:stream:")
        self.ttl = ttl or config.get("STREAM_QUEUE_TTL", 600)
        block_seconds = block_timeout or config.get("STREAM_BLOCK_TIMEOUT_SECONDS", 5)
        self.block_timeout = max(1, int(block_seconds))
        self._client = redis.Redis.from_url(self.url, decode_responses=True)

    def publish(self, token: str, chunk: str) -> None:
        if not chunk:
            return
        key = self._key(token)
        pipe = self._client.pipeline()
        pipe.rpush(key, chunk)
        pipe.expire(key, int(self.ttl))
        pipe.execute()

    def close(self, token: str) -> None:
        self.publish(token, STREAM_CLOSE_SENTINEL)

    def listen(self, token: str) -> Generator[Optional[str], None, None]:
        """Yield SSE chunks (or None on heartbeat) until the stream closes."""
        key = self._key(token)
        while True:
            result = self._client.brpop(key, timeout=self.block_timeout)
            if result is None:
                yield None
                continue
            _, chunk = result
            if chunk == STREAM_CLOSE_SENTINEL:
                self._client.delete(key)
                break
            yield chunk

    def discard(self, token: str) -> None:
        self._client.delete(self._key(token))

    def _key(self, token: str) -> str:
        return f"{self.prefix}{token}"
