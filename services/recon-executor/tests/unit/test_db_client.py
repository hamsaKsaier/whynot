"""Tests for :class:`app.clients.db.ReconDB`.

We don't stand up Postgres in unit tests — instead we mock the asyncpg pool
so the SQL-dispatch logic (which status UPDATE path to take, etc.) is
exercised without a live DB.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest

from app.clients import db as db_mod
from app.clients.db import ReconDB


class _FakePool:
    def __init__(self, conn):
        self._conn = conn
        self.closed = False

    @asynccontextmanager
    async def acquire(self):
        yield self._conn

    async def close(self):
        self.closed = True


@pytest.fixture
def rdb(monkeypatch):
    conn = AsyncMock()
    pool = _FakePool(conn)

    async def fake_create_pool(*a, **kw):
        return pool

    monkeypatch.setattr(db_mod.asyncpg, "create_pool", fake_create_pool)
    db = ReconDB("postgresql://x/y")
    return db, conn, pool


@pytest.mark.asyncio
async def test_connect_creates_pool_once(rdb):
    db, _, _ = rdb
    await db.connect()
    first_pool = db._pool
    await db.connect()  # idempotent
    assert db._pool is first_pool


@pytest.mark.asyncio
async def test_close_tears_down_pool(rdb):
    db, _, pool = rdb
    await db.connect()
    await db.close()
    assert pool.closed is True
    assert db._pool is None


@pytest.mark.asyncio
async def test_close_is_safe_without_connect(rdb):
    db, _, _ = rdb
    await db.close()  # no-op
    assert db._pool is None


@pytest.mark.asyncio
async def test_get_scan_returns_dict_when_found(rdb):
    db, conn, _ = rdb
    conn.fetchrow.return_value = {"id": "s1", "status": "pending"}
    await db.connect()
    out = await db.get_scan("s1")
    assert out == {"id": "s1", "status": "pending"}


@pytest.mark.asyncio
async def test_get_scan_returns_none_when_missing(rdb):
    db, conn, _ = rdb
    conn.fetchrow.return_value = None
    await db.connect()
    assert await db.get_scan("missing") is None


@pytest.mark.asyncio
async def test_set_scan_status_running(rdb):
    db, conn, _ = rdb
    await db.connect()
    await db.set_scan_status("s1", "running")
    conn.execute.assert_awaited_once()
    query = conn.execute.await_args.args[0]
    assert "status = $2" in query
    assert "started_at" in query
    assert "error_message = NULL" in query


@pytest.mark.asyncio
async def test_set_scan_status_completed_writes_error_message(rdb):
    db, conn, _ = rdb
    await db.connect()
    await db.set_scan_status("s1", "failed", error_message="kaboom")
    query = conn.execute.await_args.args[0]
    assert "completed_at" in query
    args = conn.execute.await_args.args[1:]
    assert "kaboom" in args


@pytest.mark.asyncio
async def test_set_scan_status_other_value(rdb):
    db, conn, _ = rdb
    await db.connect()
    await db.set_scan_status("s1", "pending")
    query = conn.execute.await_args.args[0]
    assert "status = $2" in query
    assert "completed_at" not in query  # the generic fallback path


@pytest.mark.asyncio
async def test_touch_heartbeat(rdb):
    db, conn, _ = rdb
    await db.connect()
    await db.touch_heartbeat("s1")
    query = conn.execute.await_args.args[0]
    assert "last_heartbeat_at = now()" in query


@pytest.mark.asyncio
async def test_is_cancel_requested_true_when_timestamp_set(rdb):
    db, conn, _ = rdb
    conn.fetchrow.return_value = {"cancel_requested_at": "2026-04-21T00:00:00Z"}
    await db.connect()
    assert await db.is_cancel_requested("s1") is True


@pytest.mark.asyncio
async def test_is_cancel_requested_false_when_null(rdb):
    db, conn, _ = rdb
    conn.fetchrow.return_value = {"cancel_requested_at": None}
    await db.connect()
    assert await db.is_cancel_requested("s1") is False


@pytest.mark.asyncio
async def test_is_cancel_requested_false_when_scan_missing(rdb):
    db, conn, _ = rdb
    conn.fetchrow.return_value = None
    await db.connect()
    assert await db.is_cancel_requested("s1") is False
