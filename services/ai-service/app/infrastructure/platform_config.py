"""Fetch AI provider keys from the gateway's internal platform-config endpoint.

Python mirror of services/qa-loop-executor/src/platform-config.ts — same response
shape, same cache-and-prefetch behavior, same retry cadence. Keys live in the
platform_ai_config DB table and are decrypted by the gateway before serving.
"""

import asyncio
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_cached_config: Optional[dict] = None
_fetch_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    global _fetch_lock
    if _fetch_lock is None:
        _fetch_lock = asyncio.Lock()
    return _fetch_lock


def _gateway_url() -> str:
    # Gateway listens on 3000 inside the docker network; 3010 is host-published only.
    return os.getenv("GATEWAY_URL", "http://gateway:3000")


async def get_platform_config() -> dict:
    """Fetch and cache the platform AI config. Subsequent calls return the cache."""
    global _cached_config
    if _cached_config is not None:
        return _cached_config

    async with _get_lock():
        if _cached_config is not None:
            return _cached_config
        url = f"{_gateway_url()}/api/internal/ai-config"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            _cached_config = data
            return data


async def get_platform_key(provider: str) -> Optional[str]:
    """Return the decrypted API key for the given provider, or None if not configured."""
    try:
        config = await get_platform_config()
    except Exception as e:
        logger.error("Failed to fetch platform AI config: %s", e)
        return None
    for entry in config.get("providers", []) or []:
        if entry.get("provider") == provider:
            return entry.get("apiKey") or None
    return None


def invalidate_cache() -> None:
    global _cached_config
    _cached_config = None


async def _prefetch_loop() -> None:
    """Retry cadence: 1s, 3s, 9s, 27s, 30s cap. ~5 min deadline."""
    delays = [1.0, 3.0, 9.0, 27.0]
    max_delay = 30.0
    deadline = asyncio.get_event_loop().time() + 5 * 60
    attempt = 0
    while _cached_config is None:
        try:
            await get_platform_config()
            logger.info("Platform AI config hydrated")
            return
        except Exception:
            if asyncio.get_event_loop().time() >= deadline:
                logger.warning(
                    "Platform AI config prefetch gave up; lazy refresh on first call will retry"
                )
                return
            delay = delays[attempt] if attempt < len(delays) else max_delay
            attempt += 1
            await asyncio.sleep(delay)


def prefetch() -> None:
    """Fire-and-forget: start hydrating the cache in the background."""
    if _cached_config is not None:
        return
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return
    loop.create_task(_prefetch_loop())
