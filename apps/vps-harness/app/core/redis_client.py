import time
from typing import Any, Dict, Optional

import redis.asyncio as aioredis

from app.core.config import get_settings


class _InMemoryPipeline:
    def __init__(self, store: "InMemoryRedis"):
        self._store = store
        self._ops: list[tuple[str, tuple[Any, ...]]] = []

    def incr(self, key: str) -> "_InMemoryPipeline":
        self._ops.append(("incr", (key,)))
        return self

    def expire(self, key: str, seconds: int) -> "_InMemoryPipeline":
        self._ops.append(("expire", (key, seconds)))
        return self

    async def execute(self) -> list[Any]:
        results = []
        for op, args in self._ops:
            if op == "incr":
                results.append(await self._store.incr(*args))
            elif op == "expire":
                results.append(await self._store.expire(*args))
        self._ops.clear()
        return results


class InMemoryRedis:
    """Zero-config async Redis-compatible store when local Redis daemon is unavailable."""

    def __init__(self) -> None:
        self._data: Dict[str, tuple[str, Optional[float]]] = {}

    def _purge_if_expired(self, key: str) -> None:
        entry = self._data.get(key)
        if entry is not None:
            _, exp = entry
            if exp is not None and time.monotonic() >= exp:
                self._data.pop(key, None)

    async def exists(self, key: str) -> int:
        self._purge_if_expired(key)
        return 1 if key in self._data else 0

    async def get(self, key: str) -> Optional[str]:
        self._purge_if_expired(key)
        entry = self._data.get(key)
        return entry[0] if entry else None

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        self._data[key] = (str(value), time.monotonic() + seconds)
        return True

    async def incr(self, key: str) -> int:
        self._purge_if_expired(key)
        cur = int(self._data[key][0]) if key in self._data else 0
        exp = self._data[key][1] if key in self._data else None
        nxt = cur + 1
        self._data[key] = (str(nxt), exp)
        return nxt

    async def expire(self, key: str, seconds: int) -> bool:
        self._purge_if_expired(key)
        if key not in self._data:
            return False
        val, _ = self._data[key]
        self._data[key] = (val, time.monotonic() + seconds)
        return True

    def pipeline(self) -> _InMemoryPipeline:
        return _InMemoryPipeline(self)

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        return None


async def create_redis_client() -> Any:
    url = get_settings().redis_url
    try:
        client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=0.8)
        await client.ping()
        return client
    except Exception:
        return InMemoryRedis()
