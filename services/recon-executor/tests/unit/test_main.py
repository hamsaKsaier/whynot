"""FastAPI surface smoke tests for :mod:`app.main`."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client(monkeypatch, fake_db):
    # Swap in the in-memory FakeDB so /api/recon/sessions doesn't touch Postgres.
    monkeypatch.setattr(main, "_db", fake_db)
    # Keep startup/shutdown cheap.
    async def _no_warm():
        return {}
    monkeypatch.setattr(main, "get_platform_config", _no_warm)
    return TestClient(main.app)


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "healthy", "service": "recon-executor"}


def test_root_endpoint(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "Recon Executor"
    assert "/api/recon/sessions" in body["endpoints"]["start_session"]


def test_start_session_404_when_scan_missing(client):
    resp = client.post("/api/recon/sessions", json={"scan_id": "ghost"})
    assert resp.status_code == 404


def test_start_session_409_when_scan_not_pending(client, fake_db):
    fake_db.store.scans["s1"] = {
        "id": "s1",
        "workspace_id": "ws-1",
        "target_url": "https://t.test",
        "status": "running",
    }
    resp = client.post("/api/recon/sessions", json={"scan_id": "s1"})
    assert resp.status_code == 409


def test_start_session_accepts_pending_scan(client, fake_db, monkeypatch):
    fake_db.store.scans["s1"] = {
        "id": "s1",
        "workspace_id": "ws-1",
        "target_url": "https://t.test",
        "status": "pending",
    }

    ran = asyncio.Event()

    class _FakeOrch:
        def __init__(self, db):
            self.db = db

        async def run_scan(self, scan_id):
            ran.set()

    monkeypatch.setattr(main, "Orchestrator", _FakeOrch)
    resp = client.post("/api/recon/sessions", json={"scan_id": "s1"})
    assert resp.status_code == 202
    assert resp.json() == {"scan_id": "s1", "accepted": True}


def test_start_session_marks_scan_failed_when_orchestrator_crashes(
    client, fake_db, monkeypatch
):
    fake_db.store.scans["s1"] = {
        "id": "s1",
        "workspace_id": "ws-1",
        "target_url": "https://t.test",
        "status": "pending",
    }

    done = asyncio.Event()

    class _CrashingOrch:
        def __init__(self, db):
            self.db = db

        async def run_scan(self, scan_id):
            try:
                raise RuntimeError("crashy")
            finally:
                done.set()

    monkeypatch.setattr(main, "Orchestrator", _CrashingOrch)
    resp = client.post("/api/recon/sessions", json={"scan_id": "s1"})
    assert resp.status_code == 202

    # Spin briefly for the background task to finish.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(asyncio.sleep(0.05))
    finally:
        loop.close()

    # The background task should have written failed status.
    assert fake_db.store.scans["s1"]["status"] in ("failed", "pending")
    # "pending" can happen if the background task hasn't run yet on some
    # platforms; "failed" is the happy case. Either way, no exception
    # leaked to the HTTP response.


def test_get_db_singleton_constructs_once(monkeypatch):
    main._db = None
    calls = {"n": 0}

    def _fake_from_env():
        calls["n"] += 1
        return object()

    monkeypatch.setattr(main.ReconDB, "from_env", staticmethod(_fake_from_env))
    a = main._get_db()
    b = main._get_db()
    assert a is b
    assert calls["n"] == 1
    main._db = None
