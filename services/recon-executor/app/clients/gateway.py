"""Thin client for the gateway's internal API.

Recon-executor calls the gateway only to fetch:
  - the decrypted platform AI keys (``/api/internal/ai-config``), and
  - the Recon-specific model tier overrides.

No user-facing gateway endpoints are hit from the executor.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_cached_config: Optional[dict] = None
_fetch_lock: Optional[asyncio.Lock] = None


def _lock() -> asyncio.Lock:
    global _fetch_lock
    if _fetch_lock is None:
        _fetch_lock = asyncio.Lock()
    return _fetch_lock


def _gateway_url() -> str:
    return (
        os.getenv("GATEWAY_INTERNAL_URL")
        or os.getenv("GATEWAY_URL")
        or "http://gateway:3000"
    )


async def get_platform_config() -> dict:
    global _cached_config
    cached = _cached_config
    if cached is not None:
        return cached
    async with _lock():
        cached = _cached_config
        if cached is not None:
            return cached
        url = f"{_gateway_url()}/api/internal/ai-config"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            fetched = resp.json()
            _cached_config = fetched
            return fetched


async def get_platform_key(provider: str) -> Optional[str]:
    try:
        config = await get_platform_config()
    except Exception as e:  # pragma: no cover - network failure path
        logger.error("Failed to fetch platform AI config: %s", e)
        return None
    for entry in config.get("providers", []) or []:
        if entry.get("provider") == provider:
            return entry.get("apiKey") or None
    return None


_RECON_TIERS = ("small", "medium", "large")


async def get_recon_model(tier: str) -> Optional[str]:
    if tier not in _RECON_TIERS:
        raise ValueError(f"Unknown Recon tier: {tier!r}")
    try:
        config = await get_platform_config()
    except Exception as e:  # pragma: no cover
        logger.error("Failed to fetch platform AI config: %s", e)
        return None
    override = (config.get("reconModels") or {}).get(tier)
    if override:
        return override
    default_provider = config.get("defaultProvider") or {}
    return default_provider.get("model") or None


def invalidate_cache() -> None:
    global _cached_config
    _cached_config = None
