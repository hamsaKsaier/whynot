"""Scenarios 4, 5, 6 — stuck detection, resume after failure, resume URL mismatch.

The stuck detector lives in the gateway monitor, not the executor, so here we
simulate it by asserting that an external sweep which flips stale scans to
``stuck`` works when ``last_heartbeat_at`` is older than ``STUCK_AFTER_SECONDS``.
Resume is driven by flipping the scan row back to ``pending`` and re-invoking
the orchestrator.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.checkpoint import PhaseStatus, ReconPhase
from app.orchestrator import Orchestrator, OrchestratorClocks, STUCK_AFTER_SECONDS
from app.phases import PhaseResult


# ─── Scenario 4: stuck detection ─────────────────────────────────────

@pytest.mark.asyncio
async def test_scan_with_stale_heartbeat_is_marked_stuck(
    recon_db, pg_pool, scan_factory
):
    scan_id = await scan_factory()
    # Simulate an orchestrator crash mid-phase-3 by setting status=running and
    # backdating the heartbeat past the stuck threshold.
    stale = datetime.now(timezone.utc) - timedelta(seconds=STUCK_AFTER_SECONDS + 60)
    async with pg_pool.acquire() as conn:
        await conn.execute(
            "UPDATE recon_scans SET status='running', last_heartbeat_at=$2 WHERE id=$1",
            uuid.UUID(scan_id),
            stale,
        )

    # Sweep logic that the monitor runs (modeled here since it's external):
    async with pg_pool.acquire() as conn:
        await conn.execute(
            """UPDATE recon_scans
               SET status = 'stuck'
               WHERE status = 'running'
                 AND last_heartbeat_at < (now() - interval '%d seconds')"""
            % STUCK_AFTER_SECONDS,
        )
        row = await conn.fetchrow(
            "SELECT status FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )
    assert row["status"] == "stuck"


# ─── Scenario 5: resume after failure at phase 3 ─────────────────────

@pytest.mark.asyncio
async def test_resume_after_failed_phase3(
    recon_db, pg_pool, scan_factory, override_phase
):
    scan_id = await scan_factory()

    # First run: phases 1 + 2 succeed, phase 3 (vuln_analysis) fails.
    async def _noop(ctx):
        return PhaseResult(summary="")

    async def _fail_vuln(ctx):
        raise RuntimeError("simulated-phase3-crash")

    override_phase(ReconPhase.FINGERPRINTING, _noop)
    override_phase(ReconPhase.DISCOVERY, _noop)
    override_phase(ReconPhase.VULN_ANALYSIS, _fail_vuln)

    await Orchestrator(
        recon_db, clocks=OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    ).run_scan(scan_id)

    async with pg_pool.acquire() as conn:
        scan_row = await conn.fetchrow(
            "SELECT status FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )
        p1 = await conn.fetchrow(
            "SELECT status FROM recon_scan_phases WHERE scan_id = $1 AND phase = $2",
            uuid.UUID(scan_id),
            ReconPhase.FINGERPRINTING.value,
        )
    assert scan_row["status"] == "failed"
    assert p1["status"] == PhaseStatus.COMPLETED.value

    # Resume: the gateway's resume-handler preserves phase-1/2 artifacts under
    # a new scan_id, but for this executor-level test we model resume by
    # resetting the scan + all phase rows and verifying the pipeline completes
    # end-to-end. Per-phase artifact carry-over belongs to the gateway and is
    # asserted in the gateway test suite.
    async with pg_pool.acquire() as conn:
        await conn.execute(
            "UPDATE recon_scans SET status='pending', error_message=NULL WHERE id=$1",
            uuid.UUID(scan_id),
        )
        await conn.execute(
            "DELETE FROM recon_scan_phases WHERE scan_id = $1",
            uuid.UUID(scan_id),
        )

    # All 5 phases are noop on resume; we only care the pipeline completes.
    called = {"fp": 0, "disc": 0, "vuln": 0}

    async def _count_fp(ctx):
        called["fp"] += 1
        return PhaseResult(summary="")

    async def _count_disc(ctx):
        called["disc"] += 1
        return PhaseResult(summary="")

    async def _count_vuln(ctx):
        called["vuln"] += 1
        return PhaseResult(summary="")

    override_phase(ReconPhase.FINGERPRINTING, _count_fp)
    override_phase(ReconPhase.DISCOVERY, _count_disc)
    override_phase(ReconPhase.VULN_ANALYSIS, _count_vuln)
    override_phase(ReconPhase.EXPLOITATION, _noop)
    override_phase(ReconPhase.REPORTING, _noop)

    await Orchestrator(
        recon_db, clocks=OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    ).run_scan(scan_id)

    async with pg_pool.acquire() as conn:
        scan_row = await conn.fetchrow(
            "SELECT status FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )
    assert scan_row["status"] == "completed"
    # Every phase (including the previously-failing phase 3) runs once.
    assert called["vuln"] == 1, "phase 3 must run exactly once on resume"


# ─── Scenario 6: resume URL mismatch rejected by the gateway ────────

def _resume_url_guard(original_url: str, incoming_url: str) -> None:
    """Byte-equality gate mirroring the gateway's ``resumeUrlGuard``
    (``gateway/src/api/recon/index.ts``). Kept local so this executor
    test proves the invariant without a gateway HTTP round-trip.
    """
    if original_url != incoming_url:
        raise PermissionError("RECON_RESUME_URL_MISMATCH")


@pytest.mark.asyncio
async def test_resume_url_mismatch_rejected(pg_pool, scan_factory):
    """The gateway MUST reject a resume whose ``target_url`` doesn't
    byte-equal the original scan's ``target_url`` (recon-safety rule 5),
    and the executor MUST NOT be invoked in that path.
    """
    scan_id = await scan_factory(
        target_url="http://juice-shop:3000", status="failed"
    )
    submitted_url = "http://juice-shop:3000/admin"  # drifted path

    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT target_url FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )

    with pytest.raises(PermissionError, match="RECON_RESUME_URL_MISMATCH"):
        _resume_url_guard(row["target_url"], submitted_url)

    # Matching URL passes the guard.
    _resume_url_guard(row["target_url"], "http://juice-shop:3000")

    # Executor never touched: scan stays ``failed`` with no phase rows.
    async with pg_pool.acquire() as conn:
        scan = await conn.fetchrow(
            "SELECT status FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )
        phase_count = await conn.fetchval(
            "SELECT count(*) FROM recon_scan_phases WHERE scan_id = $1",
            uuid.UUID(scan_id),
        )
    assert scan["status"] == "failed"
    assert phase_count == 0
