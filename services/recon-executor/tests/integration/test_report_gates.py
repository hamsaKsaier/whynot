"""Scenarios 9, 10 — no-exploit-no-report gate + banned-vocabulary scrubber.
"""

from __future__ import annotations

import json
import uuid

import pytest

from app.phases import reporting


# ─── Scenario 9: "no exploit, no report" gate ────────────────────────

@pytest.mark.asyncio
async def test_findings_without_poc_excluded_from_report(
    pg_pool, scan_factory, monkeypatch
):
    scan_id = await scan_factory()
    # Seed one ``confirmed`` finding with a valid PoC and one
    # ``discarded_unprovable`` with a null PoC.
    async with pg_pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO recon_findings
               (scan_id, vuln_class, status, severity, impact_score,
                exploitability_score, blast_radius_score, description,
                proof_of_concept)
               VALUES ($1, 'injection', 'confirmed', 'high', 3, 3, 3,
                       'Real SQLi', $2::jsonb),
                      ($1, 'xss', 'discarded_unprovable', null, null, null, null,
                       'Speculative — no PoC', null)""",
            uuid.UUID(scan_id),
            json.dumps({"kind": "http", "request": "GET /x?q=1' OR 1=1"}),
        )

    async def _load_findings(sid):
        async with pg_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT vuln_class, status, severity, impact_score, "
                "exploitability_score, blast_radius_score, description, "
                "proof_of_concept FROM recon_findings WHERE scan_id = $1",
                sid,
            )
        return [dict(r) for r in rows]

    async def _load_auth(_s):
        return {"justification": "it", "acknowledged_at": None}

    async def _load_meta(_s):
        return {"target_url": "http://juice-shop:3000", "locale": "en"}

    captured: dict = {}

    async def _persist_report(sid, md, summary, _pdf):
        captured["markdown"] = md
        captured["summary"] = summary
        return None

    async def _scrub_noop(md, _f):
        return md

    monkeypatch.setattr(reporting, "LOAD_FINDINGS_FN", _load_findings)
    monkeypatch.setattr(reporting, "LOAD_AUTHORIZATION_FN", _load_auth)
    monkeypatch.setattr(reporting, "LOAD_SCAN_META_FN", _load_meta)
    monkeypatch.setattr(reporting, "PERSIST_REPORT_FN", _persist_report)
    monkeypatch.setattr(reporting, "LLM_SCRUB_FN", _scrub_noop)

    from app.phases.context import PhaseContext

    ctx = PhaseContext(
        scan_id=scan_id, workspace_id=str(uuid.uuid4()), target_url="http://juice-shop:3000"
    )
    await reporting.run(ctx)

    md = captured["markdown"]
    # Confirmed finding with PoC is present; discarded-without-PoC is not.
    assert "Real SQLi" in md
    assert "Speculative — no PoC" not in md


# ─── Scenario 10: banned-vocabulary scrubber ─────────────────────────

@pytest.mark.asyncio
async def test_banned_vocabulary_is_scrubbed_even_if_llm_reintroduces_it(
    pg_pool, scan_factory, monkeypatch
):
    scan_id = await scan_factory()

    async def _load_findings(_s):
        return []

    async def _load_auth(_s):
        return {"justification": "it", "acknowledged_at": None}

    async def _load_meta(_s):
        return {"target_url": "http://juice-shop:3000", "locale": "en"}

    captured: dict = {}

    async def _persist_report(sid, md, summary, _pdf):
        captured["markdown"] = md
        return None

    # Simulate an LLM hallucination trying to inject banned vendor names.
    async def _llm_scrub(md, _f):
        return md + "\n\nPowered by Shannon and Anthropic Claude."

    monkeypatch.setattr(reporting, "LOAD_FINDINGS_FN", _load_findings)
    monkeypatch.setattr(reporting, "LOAD_AUTHORIZATION_FN", _load_auth)
    monkeypatch.setattr(reporting, "LOAD_SCAN_META_FN", _load_meta)
    monkeypatch.setattr(reporting, "PERSIST_REPORT_FN", _persist_report)
    monkeypatch.setattr(reporting, "LLM_SCRUB_FN", _llm_scrub)

    from app.phases.context import PhaseContext

    await reporting.run(
        PhaseContext(
            scan_id=scan_id,
            workspace_id=str(uuid.uuid4()),
            target_url="http://juice-shop:3000",
        )
    )

    md = captured["markdown"]
    for banned in ("Shannon", "Anthropic", "Claude"):
        assert banned not in md, f"banned vocab leaked: {banned} in {md!r}"
