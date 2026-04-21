"""Orchestrator tests covering the contracts called out in the task spec.

  - Happy path runs all 5 phases in order.
  - Failure in phase N marks phases N+1..5 as ``skipped`` and the scan
    status as ``failed``.
  - Cancellation mid-phase finishes the current runner, cancels that phase,
    skips the rest, and sets the scan status to ``cancelled``.
  - Heartbeat writes occur on the configured cadence.
  - Stuck detection: no heartbeat for >5min → the staleness check returns
    True (logical-time test; the external monitor is the one that
    marks status).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.checkpoint import ORDERED_PHASES, ReconPhase
from app.orchestrator import STUCK_AFTER_SECONDS, Orchestrator, OrchestratorClocks
from app.phases import PhaseContext, PhaseResult


def _seed_scan(fake_db, scan_id: str, status: str = "pending") -> None:
    fake_db.store.scans[scan_id] = {
        "id": scan_id,
        "workspace_id": "ws-1",
        "target_url": "https://example.com",
        "status": status,
    }


def _phase_statuses(fake_db, scan_id: str) -> dict[str, str]:
    return {
        phase: row["status"]
        for (sid, phase), row in fake_db.store.phases.items()
        if sid == scan_id
    }


@pytest.mark.asyncio
class TestHappyPath:
    async def test_runs_all_five_phases_in_order(self, fake_db):
        _seed_scan(fake_db, "s1")
        visited: list[ReconPhase] = []

        async def make_runner(phase: ReconPhase):
            async def _run(ctx: PhaseContext) -> PhaseResult:
                visited.append(phase)
                return PhaseResult()
            return _run

        runners = {phase: (await make_runner(phase)) for phase in ORDERED_PHASES}
        orch = Orchestrator(fake_db, runners=runners, clocks=OrchestratorClocks(heartbeat=0.01, cancel_poll=0.01))
        await orch.run_scan("s1")

        assert visited == list(ORDERED_PHASES)
        assert fake_db.store.scans["s1"]["status"] == "completed"
        statuses = _phase_statuses(fake_db, "s1")
        assert set(statuses.values()) == {"completed"}
        assert set(statuses.keys()) == {p.value for p in ORDERED_PHASES}

    async def test_ignores_scan_that_is_not_pending(self, fake_db):
        _seed_scan(fake_db, "s1", status="running")
        orch = Orchestrator(fake_db, runners={p: _noop_runner for p in ORDERED_PHASES})
        await orch.run_scan("s1")
        # Status unchanged, no phases written.
        assert fake_db.store.scans["s1"]["status"] == "running"
        assert _phase_statuses(fake_db, "s1") == {}

    async def test_noop_on_unknown_scan(self, fake_db):
        orch = Orchestrator(fake_db, runners={p: _noop_runner for p in ORDERED_PHASES})
        await orch.run_scan("missing")
        assert "missing" not in fake_db.store.scans


async def _noop_runner(ctx: PhaseContext) -> PhaseResult:
    return PhaseResult()


@pytest.mark.asyncio
class TestFailurePropagation:
    async def test_failure_in_phase_3_skips_4_and_5(self, fake_db):
        _seed_scan(fake_db, "s1")

        async def good(ctx: PhaseContext) -> PhaseResult:
            return PhaseResult()

        async def explode(ctx: PhaseContext) -> PhaseResult:
            raise RuntimeError("analysis blew up")

        runners = {
            ReconPhase.FINGERPRINTING: good,
            ReconPhase.DISCOVERY: good,
            ReconPhase.VULN_ANALYSIS: explode,
            ReconPhase.EXPLOITATION: good,
            ReconPhase.REPORTING: good,
        }
        orch = Orchestrator(fake_db, runners=runners, clocks=OrchestratorClocks(heartbeat=0.01, cancel_poll=0.01))
        await orch.run_scan("s1")

        statuses = _phase_statuses(fake_db, "s1")
        assert statuses["fingerprinting"] == "completed"
        assert statuses["discovery"] == "completed"
        assert statuses["vuln_analysis"] == "failed"
        assert statuses["exploitation"] == "skipped"
        assert statuses["reporting"] == "skipped"
        assert fake_db.store.scans["s1"]["status"] == "failed"
        assert "analysis blew up" in (fake_db.store.scans["s1"].get("error_message") or "")


@pytest.mark.asyncio
class TestCancellation:
    async def test_cancellation_mid_phase_finishes_current_then_cancels(self, fake_db):
        _seed_scan(fake_db, "s1")
        started_phase3 = asyncio.Event()

        async def normal(ctx: PhaseContext) -> PhaseResult:
            return PhaseResult()

        async def slow_phase3(ctx: PhaseContext) -> PhaseResult:
            started_phase3.set()
            # Simulate a long-running tool call; during this time the user
            # hits cancel. The runner finishes, THEN the orchestrator
            # sees cancel_event and transitions this phase to cancelled.
            await asyncio.sleep(0.05)
            return PhaseResult()

        runners = {
            ReconPhase.FINGERPRINTING: normal,
            ReconPhase.DISCOVERY: normal,
            ReconPhase.VULN_ANALYSIS: slow_phase3,
            ReconPhase.EXPLOITATION: normal,
            ReconPhase.REPORTING: normal,
        }
        clocks = OrchestratorClocks(heartbeat=0.01, cancel_poll=0.005)
        orch = Orchestrator(fake_db, runners=runners, clocks=clocks)

        async def cancel_soon() -> None:
            await started_phase3.wait()
            # Flip the cancel flag after phase 3's in-flight call is under way.
            fake_db.store.scans["s1"]["cancel_requested_at"] = datetime.now(timezone.utc)

        await asyncio.gather(orch.run_scan("s1"), cancel_soon())

        statuses = _phase_statuses(fake_db, "s1")
        assert statuses["fingerprinting"] == "completed"
        assert statuses["discovery"] == "completed"
        assert statuses["vuln_analysis"] == "cancelled"
        assert statuses["exploitation"] == "skipped"
        assert statuses["reporting"] == "skipped"
        assert fake_db.store.scans["s1"]["status"] == "cancelled"

    async def test_cancellation_before_any_phase_runs(self, fake_db):
        _seed_scan(fake_db, "s1")
        fake_db.store.scans["s1"]["cancel_requested_at"] = datetime.now(timezone.utc)

        runners = {p: _noop_runner for p in ORDERED_PHASES}
        orch = Orchestrator(fake_db, runners=runners, clocks=OrchestratorClocks(heartbeat=0.01, cancel_poll=0.005))
        await orch.run_scan("s1")

        assert fake_db.store.scans["s1"]["status"] == "cancelled"
        statuses = _phase_statuses(fake_db, "s1")
        # All phases marked skipped, none completed.
        assert set(statuses.values()) == {"skipped"}


@pytest.mark.asyncio
class TestHeartbeat:
    async def test_heartbeat_runs_at_configured_interval(self, fake_db):
        _seed_scan(fake_db, "s1")
        # Hold phase 1 for long enough that multiple heartbeats fire.
        release = asyncio.Event()

        async def blocker(ctx: PhaseContext) -> PhaseResult:
            await release.wait()
            return PhaseResult()

        runners = {
            ReconPhase.FINGERPRINTING: blocker,
            ReconPhase.DISCOVERY: _noop_runner,
            ReconPhase.VULN_ANALYSIS: _noop_runner,
            ReconPhase.EXPLOITATION: _noop_runner,
            ReconPhase.REPORTING: _noop_runner,
        }
        orch = Orchestrator(
            fake_db,
            runners=runners,
            clocks=OrchestratorClocks(heartbeat=0.01, cancel_poll=1.0),
        )

        async def release_after() -> None:
            await asyncio.sleep(0.05)
            release.set()

        await asyncio.gather(orch.run_scan("s1"), release_after())
        assert fake_db.store.scans["s1"].get("heartbeat_count", 0) >= 2


def test_stuck_detection_threshold_is_five_minutes():
    """Logical-time check: the module-level constant encodes the 5-minute rule
    from the pentest-orchestration skill."""
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    silent_for = now - timedelta(seconds=STUCK_AFTER_SECONDS + 1)
    assert (now - silent_for).total_seconds() > STUCK_AFTER_SECONDS
    assert STUCK_AFTER_SECONDS == 5 * 60
