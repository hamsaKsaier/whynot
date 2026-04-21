"""Tests for the thin phase runner modules (non-exploitation, non-reporting).

Exploitation-phase tests live in ``test_exploitation_orchestrator.py`` and
the per-exploiter files (``test_<class>_exploiter.py``). Reporting-phase
tests live in ``test_reporting_phase.py``.
"""

from __future__ import annotations

import pytest

from app.phases import PhaseContext
from app.phases import discovery, fingerprinting, vuln_analysis


@pytest.fixture
def ctx() -> PhaseContext:
    return PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")


@pytest.mark.asyncio
async def test_fingerprinting_populates_state(ctx, monkeypatch):
    async def stub_tool(argv):
        del argv
        return ""

    monkeypatch.setattr(fingerprinting, "RUN_TOOL_FN", stub_tool)
    await fingerprinting.run(ctx)
    assert "fingerprint" in ctx.state
    assert ctx.state["fingerprint"]["target_url"] == "https://t.test"


@pytest.mark.asyncio
async def test_discovery_populates_attack_surface(ctx):
    await discovery.run(ctx)
    assert "attack_surface" in ctx.state
    assert "endpoints" in ctx.state["attack_surface"]


@pytest.mark.asyncio
async def test_vuln_analysis_survives_failing_agent(ctx, monkeypatch):
    async def good_agent(vuln_class, c):
        return [{"id": f"{vuln_class}-1"}]

    async def broken_agent(vuln_class, c):
        raise RuntimeError("agent crashed")

    monkeypatch.setitem(vuln_analysis.AGENTS, "injection", good_agent)
    monkeypatch.setitem(vuln_analysis.AGENTS, "xss", broken_agent)
    monkeypatch.setitem(vuln_analysis.AGENTS, "ssrf", good_agent)
    monkeypatch.setitem(vuln_analysis.AGENTS, "auth", good_agent)
    monkeypatch.setitem(vuln_analysis.AGENTS, "authz", good_agent)

    await vuln_analysis.run(ctx)
    hyp = ctx.state["hypotheses"]
    assert hyp["injection"] == [{"id": "injection-1"}]
    assert hyp["xss"] == []
    assert ctx.state["vuln_analysis_failures"] == ["xss"]


