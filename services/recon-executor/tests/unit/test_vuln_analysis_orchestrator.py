"""Unit tests for the phase-3 orchestrator (``vuln_analysis.run``).

Covers:
  - Happy path: all 5 agents succeed, hypotheses aggregated.
  - Partial failure: 1 agent raises, phase still ``completed`` with 4 classes.
  - Total failure: all 5 raise → phase raises ``RuntimeError`` with aggregated
    error so the orchestrator can mark the phase ``failed``.
  - Concurrency: agents run in parallel (5 × 200ms should complete well
    under 500ms).
  - Artifact persistence seam is called with phase + kind + payload shape.
  - Billing is emitted by default and suppressed when the flag is set.
  - Default seam implementations (persist + emit) return None.
  - Default AGENTS wire through to the real per-class agents.
  - ``Hypothesis`` / ``VulnAnalysisResult`` dataclass shape.
"""

from __future__ import annotations

import asyncio
import time

import pytest

from app.agents import VULN_CLASSES, Hypothesis
from app.phases import PhaseContext
from app.phases import vuln_analysis as va
from app.phases.vuln_analysis import VulnAnalysisResult


@pytest.fixture
def ctx() -> PhaseContext:
    return PhaseContext(
        scan_id="scan-1",
        workspace_id="ws-1",
        target_url="https://t.test",
    )


def _install_agents(monkeypatch, factory):
    for cls in VULN_CLASSES:
        monkeypatch.setitem(va.AGENTS, cls, factory(cls))


# ─── Happy paths ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_all_agents_succeed_aggregates_hypotheses(monkeypatch, ctx):
    def factory(cls):
        async def agent(vc, _c):
            return [
                {
                    "vuln_class": vc,
                    "endpoint": f"/{vc}",
                    "param": None,
                    "reasoning": "r",
                    "candidate_payloads": ["p"],
                    "expected_outcome": "o",
                }
            ]

        return agent

    _install_agents(monkeypatch, factory)
    result = await va.run(ctx)

    hyp = ctx.state["hypotheses"]
    assert set(hyp.keys()) == set(VULN_CLASSES)
    assert all(len(hyp[cls]) == 1 for cls in VULN_CLASSES)
    assert ctx.state["vuln_analysis_failures"] == []
    assert result.summary == "5 hypotheses across 5 classes"


@pytest.mark.asyncio
async def test_one_agent_failure_does_not_fail_phase(monkeypatch, ctx):
    async def good(vc, _c):
        return [{"endpoint": f"/{vc}", "vuln_class": vc}]

    async def bad(vc, _c):
        raise RuntimeError(f"{vc}-boom")

    monkeypatch.setitem(va.AGENTS, "injection", good)
    monkeypatch.setitem(va.AGENTS, "xss", bad)
    monkeypatch.setitem(va.AGENTS, "ssrf", good)
    monkeypatch.setitem(va.AGENTS, "auth", good)
    monkeypatch.setitem(va.AGENTS, "authz", good)

    result = await va.run(ctx)

    assert ctx.state["hypotheses"]["xss"] == []
    assert ctx.state["hypotheses"]["injection"] == [
        {"endpoint": "/injection", "vuln_class": "injection"}
    ]
    assert ctx.state["vuln_analysis_failures"] == ["xss"]
    # 4 successful classes with 1 hypothesis each = 4 total.
    assert result.summary == "4 hypotheses across 4 classes"


@pytest.mark.asyncio
async def test_all_agents_failing_raises_aggregated_error(monkeypatch, ctx):
    async def bad(vc, _c):
        raise RuntimeError(f"{vc}-boom")

    _install_agents(monkeypatch, lambda _cls: bad)

    with pytest.raises(RuntimeError) as exc_info:
        await va.run(ctx)
    msg = str(exc_info.value)
    assert msg.startswith("all vuln-analysis agents failed")
    for cls in VULN_CLASSES:
        assert f"{cls}-boom" in msg


# ─── Concurrency ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_agents_run_concurrently(monkeypatch, ctx):
    async def slow(_vc, _c):
        await asyncio.sleep(0.2)
        return []

    _install_agents(monkeypatch, lambda _cls: slow)

    t0 = time.monotonic()
    await va.run(ctx)
    elapsed = time.monotonic() - t0
    # Sequential = 5 × 0.2s = 1.0s; concurrent must be well under 0.5s.
    assert elapsed < 0.5, f"agents appear to have run sequentially: {elapsed:.3f}s"


# ─── Artifact + billing seams ────────────────────────────────────────


@pytest.mark.asyncio
async def test_artifact_persisted_with_vuln_analysis_payload(monkeypatch, ctx):
    captured: list[tuple] = []

    async def capture(scan_id, phase, kind, payload):
        captured.append((scan_id, phase, kind, payload))
        return "art-vuln-1"

    async def empty(_vc, _c):
        return []

    _install_agents(monkeypatch, lambda _cls: empty)
    monkeypatch.setattr(va, "PERSIST_ARTIFACT_FN", capture)

    result = await va.run(ctx)

    assert result.artifact_id == "art-vuln-1"
    assert len(captured) == 1
    scan_id, phase, kind, payload = captured[0]
    assert scan_id == "scan-1"
    assert phase == "vuln_analysis"
    assert kind == "json"
    assert set(payload.keys()) == {"hypotheses", "failures"}
    assert set(payload["hypotheses"].keys()) == set(VULN_CLASSES)


@pytest.mark.asyncio
async def test_billing_event_emitted_by_default(monkeypatch, ctx):
    emitted: list[tuple] = []

    async def emit(ws, ev, qty):
        emitted.append((ws, ev, qty))

    async def empty(_vc, _c):
        return []

    _install_agents(monkeypatch, lambda _cls: empty)
    monkeypatch.setattr(va, "EMIT_BILLING_FN", emit)

    await va.run(ctx)
    assert emitted == [("ws-1", "recon_phase_vuln_analysis", 1)]


@pytest.mark.asyncio
async def test_billing_suppressed_when_flag_set(monkeypatch, ctx):
    emitted: list[tuple] = []

    async def emit(ws, ev, qty):
        emitted.append((ws, ev, qty))

    async def empty(_vc, _c):
        return []

    _install_agents(monkeypatch, lambda _cls: empty)
    monkeypatch.setattr(va, "EMIT_BILLING_FN", emit)
    ctx.state["suppress_per_phase_billing"] = True

    await va.run(ctx)
    assert emitted == []


# ─── Default seams + dataclasses (coverage) ──────────────────────────


@pytest.mark.asyncio
async def test_default_persist_artifact_returns_none():
    assert await va._default_persist_artifact("s", "p", "k", {"x": 1}) is None


@pytest.mark.asyncio
async def test_default_emit_billing_returns_none():
    assert await va._default_emit_billing("ws", "event", 2) is None


def test_vuln_analysis_result_defaults():
    r = VulnAnalysisResult()
    assert r.hypotheses == {}
    assert r.failures == []


def test_hypothesis_dataclass_shape():
    h = Hypothesis(
        vuln_class="injection",
        endpoint="/x",
        param="id",
        reasoning="r",
        candidate_payloads=["p1", "p2"],
        expected_outcome="200 OK with all rows",
    )
    assert h.vuln_class == "injection"
    assert h.param == "id"
    assert h.candidate_payloads == ["p1", "p2"]


@pytest.mark.asyncio
async def test_default_agents_return_empty_lists_for_empty_surface(ctx):
    """With no monkeypatching and no attack_surface in state, every real
    agent in the registry must return an empty hypothesis list without
    raising. Exercises the ``_run_*`` wrappers and ``default_llm_analyze``.
    """
    result = await va.run(ctx)
    hyp = ctx.state["hypotheses"]
    assert set(hyp.keys()) == set(VULN_CLASSES)
    assert all(hyp[cls] == [] for cls in VULN_CLASSES)
    assert ctx.state["vuln_analysis_failures"] == []
    assert result.summary == "0 hypotheses across 5 classes"
