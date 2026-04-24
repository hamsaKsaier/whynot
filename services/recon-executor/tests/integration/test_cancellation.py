"""Scenario 2 — Cancellation mid-discovery.

Request cancellation while phase 2 (discovery) is running. The orchestrator
must finalise the scan as ``cancelled``, leave phase 1 = completed and
phase 2 = cancelled, and skip phases 3-5. Only the fingerprinting billing
event must have fired.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest

from app.checkpoint import ORDERED_PHASES, PhaseStatus, ReconPhase
from app.orchestrator import Orchestrator, OrchestratorClocks
from app.phases import PhaseResult


@pytest.mark.asyncio
async def test_cancellation_mid_discovery(
    recon_db, pg_pool, scan_factory, billing_events, override_phase, monkeypatch
):
    scan_id = await scan_factory()

    cancel_sent = asyncio.Event()

    # Fingerprinting is a noop so the real binaries never run; discovery
    # blocks until we request cancellation.
    async def _fp_noop(ctx):
        # Emit the billing event exactly as the real phase does so the test
        # assertion about "only phase-1 billing fired" is meaningful.
        from app.phases import fingerprinting as fp
        await fp.EMIT_BILLING_FN(ctx.workspace_id, "recon_phase_fingerprinting", 1)
        return PhaseResult(summary="stub")

    async def _slow_discovery(ctx):
        await cancel_sent.wait()
        # Give the cancel watcher a tick to observe the DB flip.
        await asyncio.sleep(0.5)
        return PhaseResult(summary="interrupted")

    override_phase(ReconPhase.FINGERPRINTING, _fp_noop)
    override_phase(ReconPhase.DISCOVERY, _slow_discovery)

    clocks = OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    orch = Orchestrator(recon_db, clocks=clocks)
    task = asyncio.create_task(orch.run_scan(scan_id))

    # Wait until fingerprinting completed and discovery has started.
    for _ in range(50):
        await asyncio.sleep(0.1)
        async with pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT status FROM recon_scan_phases "
                "WHERE scan_id = $1 AND phase = 'discovery'",
                uuid.UUID(scan_id),
            )
        if row and row["status"] == "running":
            break

    # Request cancellation.
    async with pg_pool.acquire() as conn:
        await conn.execute(
            "UPDATE recon_scans SET cancel_requested_at = now() WHERE id = $1",
            uuid.UUID(scan_id),
        )
    cancel_sent.set()
    await task

    async with pg_pool.acquire() as conn:
        scan = await conn.fetchrow(
            "SELECT status FROM recon_scans WHERE id = $1", uuid.UUID(scan_id)
        )
        phases = await conn.fetch(
            "SELECT phase, status FROM recon_scan_phases WHERE scan_id = $1",
            uuid.UUID(scan_id),
        )

    assert scan["status"] == "cancelled"
    by_phase = {r["phase"]: r["status"] for r in phases}
    assert by_phase[ORDERED_PHASES[0].value] == PhaseStatus.COMPLETED.value
    assert by_phase[ORDERED_PHASES[1].value] == PhaseStatus.CANCELLED.value
    for p in ORDERED_PHASES[2:]:
        assert by_phase[p.value] in (
            PhaseStatus.PENDING.value,
            PhaseStatus.SKIPPED.value,
        )

    # Only fingerprinting billing event should have fired.
    fired = [e["event_type"] for e in billing_events]
    assert "recon_phase_fingerprinting" in fired
    for other in (
        "recon_phase_discovery",
        "recon_phase_vuln_analysis",
        "recon_phase_exploitation",
        "recon_phase_reporting",
        "recon_scan_run",
    ):
        assert other not in fired, fired
