"""Remaining coverage closers — exception paths in orchestrator background
loops, default stubs in phase modules, and the FastAPI startup / shutdown
hooks in :mod:`app.main`."""

from __future__ import annotations

import asyncio

import pytest

from app import main
from app.checkpoint import ORDERED_PHASES
from app.orchestrator import Orchestrator, OrchestratorClocks
from app.phases import PhaseContext
from app.phases import exploitation, vuln_analysis


# ─── Default phase stubs ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_default_vuln_analysis_agent_returns_empty_list():
    # With no attack_surface in state, every default agent wrapper must
    # degrade to an empty hypothesis list without raising.
    ctx = PhaseContext(scan_id="s", workspace_id="w", target_url="u")
    for cls in vuln_analysis.VULN_CLASSES:
        out = await vuln_analysis.AGENTS[cls](cls, ctx)
        assert out == []


@pytest.mark.asyncio
async def test_default_exploit_attempt_returns_failed_outcome():
    ctx = PhaseContext(scan_id="s", workspace_id="w", target_url="u")
    hypothesis = {"id": "c", "vuln_class": "x"}
    result = await exploitation._noop_attempt(hypothesis, ctx)
    assert result.outcome == exploitation.ExploitOutcome.FAILED


# ─── Orchestrator background-loop exception handlers ────────────────

class _FlakyDB:
    """DB stand-in where ``touch_heartbeat`` and ``is_cancel_requested`` raise
    on the first call and succeed on the second."""

    def __init__(self):
        self.heart_calls = 0
        self.cancel_calls = 0
        self.stop_cancel_after = 2

    async def touch_heartbeat(self, scan_id):
        self.heart_calls += 1
        if self.heart_calls == 1:
            raise RuntimeError("db down")

    async def is_cancel_requested(self, scan_id):
        self.cancel_calls += 1
        if self.cancel_calls == 1:
            raise RuntimeError("db flaky")
        return False


@pytest.mark.asyncio
async def test_heartbeat_loop_swallows_db_errors():
    db = _FlakyDB()
    orch = Orchestrator.__new__(Orchestrator)
    orch.db = db
    orch.clocks = OrchestratorClocks(heartbeat=0.01, cancel_poll=0.01)
    stop = asyncio.Event()
    task = asyncio.create_task(orch._heartbeat_loop("s1", stop))
    await asyncio.sleep(0.05)
    stop.set()
    await task
    assert db.heart_calls >= 2  # survived the first failure and kept going


@pytest.mark.asyncio
async def test_cancel_watcher_swallows_db_errors():
    db = _FlakyDB()
    orch = Orchestrator.__new__(Orchestrator)
    orch.db = db
    orch.clocks = OrchestratorClocks(heartbeat=0.01, cancel_poll=0.01)
    cancel_event = asyncio.Event()
    task = asyncio.create_task(orch._cancel_watcher("s1", cancel_event))
    await asyncio.sleep(0.05)
    cancel_event.set()
    await task
    assert db.cancel_calls >= 2


class _CancelCheckFailingDB:
    """Only ``is_cancel_requested`` raises. Used to exercise the direct-check
    error path in :meth:`Orchestrator._cancellation_pending`."""

    async def is_cancel_requested(self, scan_id):
        raise RuntimeError("db boom")


@pytest.mark.asyncio
async def test_cancellation_pending_swallows_direct_check_errors():
    db = _CancelCheckFailingDB()
    orch = Orchestrator.__new__(Orchestrator)
    orch.db = db
    orch.clocks = OrchestratorClocks()
    cancel_event = asyncio.Event()
    # Should not raise, should return False (no cancel detected).
    assert await orch._cancellation_pending("s1", cancel_event) is False
    assert cancel_event.is_set() is False


# ─── main.py startup / shutdown / background error ──────────────────

@pytest.mark.asyncio
async def test_on_startup_survives_db_failure(monkeypatch):
    main._db = None

    class _BadDB:
        async def connect(self):
            raise RuntimeError("can't reach postgres")

    monkeypatch.setattr(main, "_get_db", lambda: _BadDB())

    async def fake_warm():
        return {}

    monkeypatch.setattr(main, "get_platform_config", fake_warm)
    # Should not raise.
    await main._on_startup()
    main._db = None


@pytest.mark.asyncio
async def test_on_startup_warm_task_catches_errors(monkeypatch):
    main._db = None

    class _OKDB:
        async def connect(self):
            return None

    monkeypatch.setattr(main, "_get_db", lambda: _OKDB())

    async def boom_warm():
        raise RuntimeError("warm failed")

    monkeypatch.setattr(main, "get_platform_config", boom_warm)
    await main._on_startup()
    # Yield so the background task runs and hits the except branch.
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    main._db = None


@pytest.mark.asyncio
async def test_on_shutdown_closes_db(monkeypatch):
    closed = {"n": 0}

    class _DB:
        async def close(self):
            closed["n"] += 1

    main._db = _DB()
    await main._on_shutdown()
    assert closed["n"] == 1
    main._db = None


@pytest.mark.asyncio
async def test_on_shutdown_noop_when_db_none():
    main._db = None
    await main._on_shutdown()
    assert main._db is None


@pytest.mark.asyncio
async def test_start_session_background_handles_db_failure_on_retry(monkeypatch, fake_db):
    """Covers the inner except in the POST handler's detached task."""
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "_db", fake_db)
    fake_db.store.scans["s1"] = {
        "id": "s1",
        "workspace_id": "ws",
        "target_url": "https://t.test",
        "status": "pending",
    }

    class _CrashOrch:
        def __init__(self, db):
            pass

        async def run_scan(self, scan_id):
            raise RuntimeError("orchestrator died")

    # Make the fallback set_scan_status also raise, forcing the inner except.
    async def bad_set_status(*a, **kw):
        raise RuntimeError("db gone")

    monkeypatch.setattr(main, "Orchestrator", _CrashOrch)
    fake_db.set_scan_status = bad_set_status  # type: ignore

    with TestClient(main.app) as client:
        resp = client.post("/api/recon/sessions", json={"scan_id": "s1"})
    assert resp.status_code == 202
    await asyncio.sleep(0.05)  # let the background task run through


# ─── Branch closers (cov-branch) ────────────────────────────────────

@pytest.mark.asyncio
async def test_skip_remaining_leaves_non_pending_phases_alone(fake_db):
    """``_skip_remaining`` must respect existing non-PENDING rows so that an
    earlier failure or cancellation isn't overwritten by a defensive ``skip``.
    Covers the false branch of the ``current == PENDING`` check.
    """
    from app.checkpoint import PhaseStatus, ReconPhase

    scan_id = "scan-skip-branch"
    fake_db.store.scans[scan_id] = {"id": scan_id, "status": "running"}
    # Pre-populate one phase as already FAILED.
    fake_db.store.phases[(scan_id, ReconPhase.EXPLOITATION.value)] = {
        "scan_id": scan_id,
        "phase": ReconPhase.EXPLOITATION.value,
        "status": PhaseStatus.FAILED.value,
    }
    orch = Orchestrator(fake_db)
    await orch._skip_remaining(
        [ReconPhase.EXPLOITATION, ReconPhase.REPORTING], scan_id
    )
    assert (
        fake_db.store.phases[(scan_id, ReconPhase.EXPLOITATION.value)]["status"]
        == PhaseStatus.FAILED.value
    )
    assert (
        fake_db.store.phases[(scan_id, ReconPhase.REPORTING.value)]["status"]
        == PhaseStatus.SKIPPED.value
    )


@pytest.mark.asyncio
async def test_collect_js_endpoints_dedups_within_bundle(monkeypatch):
    """Inner-loop dedup branch (``ep not in endpoints``): the same endpoint
    appearing twice in one bundle must only be recorded once."""
    from app.phases import discovery

    async def fake_fetch(url, auth):
        # Two bundles each contain ``/api/x`` so the second occurrence hits
        # the false branch of the dedup ``if`` inside ``_collect_js_endpoints``.
        if "a.js" in url:
            return {"body": "fetch('/api/x'); fetch('/api/y');", "url": url}
        return {"body": "fetch('/api/x'); fetch('/api/z');", "url": url}

    monkeypatch.setattr(discovery, "FETCH_PAGE_FN", fake_fetch)
    out = await discovery._collect_js_endpoints(["http://t/a.js", "http://t/b.js"])
    assert out == ["/api/x", "/api/y", "/api/z"]
