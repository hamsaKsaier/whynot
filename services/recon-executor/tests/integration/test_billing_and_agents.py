"""Scenarios 7, 8 — per-phase billing and per-vuln-class agent partial failure.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest

from app.checkpoint import PhaseStatus, ReconPhase
from app.orchestrator import Orchestrator, OrchestratorClocks
from app.phases import PhaseResult, exploitation, reporting, vuln_analysis


# ─── Scenario 7: per-phase billing on partial cancellation ───────────

@pytest.mark.asyncio
async def test_per_phase_billing_sum_on_partial_cancellation(
    recon_db, pg_pool, scan_factory, billing_events, override_phase
):
    scan_id = await scan_factory()

    # Phase 1 + 2 complete; phase 3 is where we cancel.
    cancel_barrier = asyncio.Event()

    async def _slow_vuln(ctx):
        await cancel_barrier.wait()
        await asyncio.sleep(0.3)
        return PhaseResult(summary="")

    async def _phase_billing(ws_id, event_type, qty):
        billing_events.append(
            {"workspace_id": ws_id, "event_type": event_type, "quantity": qty}
        )

    async def _fp(ctx):
        await _phase_billing(ctx.workspace_id, "recon_phase_fingerprinting", 1)
        return PhaseResult(summary="")

    async def _disc(ctx):
        await _phase_billing(ctx.workspace_id, "recon_phase_discovery", 1)
        return PhaseResult(summary="")

    override_phase(ReconPhase.FINGERPRINTING, _fp)
    override_phase(ReconPhase.DISCOVERY, _disc)
    override_phase(ReconPhase.VULN_ANALYSIS, _slow_vuln)

    orch = Orchestrator(
        recon_db, clocks=OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    )
    task = asyncio.create_task(orch.run_scan(scan_id))

    # Wait for phase 3 to begin, then cancel.
    for _ in range(50):
        await asyncio.sleep(0.05)
        async with pg_pool.acquire() as conn:
            r = await conn.fetchrow(
                "SELECT status FROM recon_scan_phases "
                "WHERE scan_id = $1 AND phase = 'vuln_analysis'",
                uuid.UUID(scan_id),
            )
        if r and r["status"] == "running":
            break

    async with pg_pool.acquire() as conn:
        await conn.execute(
            "UPDATE recon_scans SET cancel_requested_at = now() WHERE id = $1",
            uuid.UUID(scan_id),
        )
    cancel_barrier.set()
    await task

    # Only per-phase events 1 + 2 should have been emitted; exactly two events.
    phase_events = [e for e in billing_events if e["event_type"].startswith("recon_phase_")]
    assert [e["event_type"] for e in phase_events] == [
        "recon_phase_fingerprinting",
        "recon_phase_discovery",
    ]
    assert sum(e["quantity"] for e in phase_events) == 2


# ─── Scenario 8: one vuln-class agent fails, others produce hypotheses ─

@pytest.mark.asyncio
async def test_vuln_analysis_one_agent_fails_others_continue(
    recon_db, pg_pool, scan_factory, override_phase, monkeypatch
):
    scan_id = await scan_factory()

    async def _noop(ctx):
        return PhaseResult(summary="")

    override_phase(ReconPhase.FINGERPRINTING, _noop)
    override_phase(ReconPhase.DISCOVERY, _noop)
    override_phase(ReconPhase.EXPLOITATION, _noop)
    override_phase(ReconPhase.REPORTING, _noop)

    collected: dict[str, list] = {}

    async def _injection_agent(cls, ctx):
        raise RuntimeError("simulated injection-agent crash")

    async def _working_agent(cls, ctx):
        collected.setdefault(cls, []).append({"id": f"h-{cls}"})
        return [{"id": f"h-{cls}", "vuln_class": cls}]

    new_agents = {
        "injection": _injection_agent,
        "xss": _working_agent,
        "ssrf": _working_agent,
        "auth": _working_agent,
        "authz": _working_agent,
    }
    monkeypatch.setattr(vuln_analysis, "AGENTS", new_agents)
    monkeypatch.setattr(vuln_analysis, "PERSIST_ARTIFACT_FN", _nop_artifact)

    await Orchestrator(
        recon_db, clocks=OrchestratorClocks(heartbeat=0.2, cancel_poll=0.1)
    ).run_scan(scan_id)

    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status FROM recon_scan_phases "
            "WHERE scan_id = $1 AND phase = 'vuln_analysis'",
            uuid.UUID(scan_id),
        )
    assert row["status"] == PhaseStatus.COMPLETED.value
    # 4 of 5 agents produced hypotheses; injection was suppressed.
    assert set(collected.keys()) == {"xss", "ssrf", "auth", "authz"}


async def _nop_artifact(*_a, **_kw):
    return None
