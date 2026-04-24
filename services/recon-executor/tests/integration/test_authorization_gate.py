"""Scenario 3 — Authorization missing → phase 4 aborts the scan as ``failed``.

The gateway normally writes ``recon_scan_authorizations`` before enqueuing,
but the phase-4 pre-flight is defense-in-depth (recon-safety rule 1). This
test drives a scan whose authorization row was never inserted and asserts
the scan ends with ``error_message='authorization_missing'``.
"""

from __future__ import annotations

import uuid

import pytest

from app.checkpoint import PhaseStatus, ReconPhase
from app.orchestrator import Orchestrator, OrchestratorClocks
from app.phases import PhaseResult, discovery, fingerprinting, reporting, vuln_analysis, exploitation


@pytest.mark.asyncio
async def test_phase4_aborts_when_authorization_missing(
    recon_db, pg_pool, scan_factory, override_phase, monkeypatch
):
    scan_id = await scan_factory(with_authorization=False)

    async def _noop(ctx):
        return PhaseResult(summary="")

    # Let phases 1-3 succeed so we reach the exploitation gate.
    override_phase(ReconPhase.FINGERPRINTING, _noop)
    override_phase(ReconPhase.DISCOVERY, _noop)
    override_phase(ReconPhase.VULN_ANALYSIS, _noop)
    override_phase(ReconPhase.REPORTING, _noop)

    # Real AUTH_CHECK_FN against the DB.
    async def _real_auth_check(sid: str) -> bool:
        async with pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM recon_scan_authorizations WHERE scan_id = $1", sid
            )
            return row is not None

    monkeypatch.setattr(exploitation, "AUTH_CHECK_FN", _real_auth_check)

    await Orchestrator(
        recon_db, clocks=OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    ).run_scan(scan_id)

    async with pg_pool.acquire() as conn:
        scan = await conn.fetchrow(
            "SELECT status, error_message FROM recon_scans WHERE id = $1",
            uuid.UUID(scan_id),
        )
        exploitation_row = await conn.fetchrow(
            "SELECT status FROM recon_scan_phases "
            "WHERE scan_id = $1 AND phase = $2",
            uuid.UUID(scan_id),
            ReconPhase.EXPLOITATION.value,
        )

    assert scan["status"] == "failed"
    assert scan["error_message"] == "authorization_missing"
    assert exploitation_row["status"] == PhaseStatus.FAILED.value
