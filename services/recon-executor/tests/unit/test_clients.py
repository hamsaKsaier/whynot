"""Tests for the gateway + db client wrappers."""

from __future__ import annotations

import pytest

from app.clients import gateway
from app.clients.db import ReconDB


# ─── gateway client ─────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_gateway_cache():
    gateway.invalidate_cache()
    yield
    gateway.invalidate_cache()


@pytest.mark.asyncio
async def test_get_platform_key_returns_configured_value(monkeypatch):
    async def fake_config():
        return {"providers": [{"provider": "anthropic", "apiKey": "sk-123"}]}

    monkeypatch.setattr(gateway, "get_platform_config", fake_config)
    key = await gateway.get_platform_key("anthropic")
    assert key == "sk-123"


@pytest.mark.asyncio
async def test_get_platform_key_returns_none_when_missing(monkeypatch):
    async def fake_config():
        return {"providers": [{"provider": "openai", "apiKey": "x"}]}

    monkeypatch.setattr(gateway, "get_platform_config", fake_config)
    assert await gateway.get_platform_key("anthropic") is None


@pytest.mark.asyncio
async def test_get_recon_model_uses_tier_override(monkeypatch):
    async def fake_config():
        return {
            "reconModels": {"large": "claude-override"},
            "defaultProvider": {"model": "claude-default"},
        }

    monkeypatch.setattr(gateway, "get_platform_config", fake_config)
    assert await gateway.get_recon_model("large") == "claude-override"


@pytest.mark.asyncio
async def test_get_recon_model_falls_back_to_platform_default(monkeypatch):
    async def fake_config():
        return {"reconModels": {}, "defaultProvider": {"model": "claude-default"}}

    monkeypatch.setattr(gateway, "get_platform_config", fake_config)
    assert await gateway.get_recon_model("small") == "claude-default"


@pytest.mark.asyncio
async def test_get_recon_model_rejects_unknown_tier():
    with pytest.raises(ValueError):
        await gateway.get_recon_model("xlarge")


@pytest.mark.asyncio
async def test_platform_config_caches(monkeypatch):
    calls = {"n": 0}

    class _FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            calls["n"] += 1
            return {"providers": []}

    class _FakeClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url):
            return _FakeResp()

    monkeypatch.setattr(gateway.httpx, "AsyncClient", _FakeClient)
    c1 = await gateway.get_platform_config()
    c2 = await gateway.get_platform_config()
    assert c1 is c2
    assert calls["n"] == 1  # second call hits cache


def test_gateway_url_prefers_internal_env(monkeypatch):
    monkeypatch.setenv("GATEWAY_INTERNAL_URL", "http://gateway-internal:3000")
    monkeypatch.setenv("GATEWAY_URL", "http://fallback:3000")
    assert gateway._gateway_url() == "http://gateway-internal:3000"


def test_gateway_url_falls_back_to_gateway_url(monkeypatch):
    monkeypatch.delenv("GATEWAY_INTERNAL_URL", raising=False)
    monkeypatch.setenv("GATEWAY_URL", "http://fallback:3000")
    assert gateway._gateway_url() == "http://fallback:3000"


def test_gateway_url_default(monkeypatch):
    monkeypatch.delenv("GATEWAY_INTERNAL_URL", raising=False)
    monkeypatch.delenv("GATEWAY_URL", raising=False)
    assert gateway._gateway_url() == "http://gateway:3000"


@pytest.mark.asyncio
async def test_platform_config_double_checked_locking(monkeypatch):
    """Two concurrent callers race on the lock; the second sees the cache
    already populated and returns via the post-lock early-return branch.
    """
    import asyncio

    release = asyncio.Event()
    call_count = {"n": 0}

    class _FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            call_count["n"] += 1
            return {"providers": []}

    class _FakeClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url):
            # Hold the first caller inside the lock until both tasks are queued.
            await release.wait()
            return _FakeResp()

    monkeypatch.setattr(gateway.httpx, "AsyncClient", _FakeClient)

    async def caller():
        return await gateway.get_platform_config()

    t1 = asyncio.create_task(caller())
    await asyncio.sleep(0)  # let t1 take the lock
    t2 = asyncio.create_task(caller())
    await asyncio.sleep(0)  # queue t2 on the lock
    release.set()
    r1, r2 = await asyncio.gather(t1, t2)
    assert r1 == r2
    assert call_count["n"] == 1  # only one network fetch despite two callers


# ─── ReconDB ─────────────────────────────────────────────────────────

def test_recon_db_from_env_requires_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError):
        ReconDB.from_env()


def test_recon_db_from_env_constructs_with_dsn(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://x/y")
    db = ReconDB.from_env()
    assert db._dsn == "postgresql://x/y"


def test_recon_db_acquire_requires_pool():
    db = ReconDB("postgresql://x/y")
    with pytest.raises(RuntimeError):
        db.acquire()
