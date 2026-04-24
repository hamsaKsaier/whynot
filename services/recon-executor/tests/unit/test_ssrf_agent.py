"""Unit tests for the phase-3 SSRF agent."""

from __future__ import annotations

import json

import pytest

import app.agents.ssrf_agent as ssrf_agent
from app.agents import default_llm_analyze
from app.phases import PhaseContext


def _ctx_with_surface() -> PhaseContext:
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {"endpoints": ["/api/fetch-url", "/api/webhook"]}
    c.state["fingerprint"] = {"source_stack": {"framework": "express"}}
    return c


def test_vuln_class_label():
    assert ssrf_agent.VULN_CLASS == "ssrf"


def test_prompt_performs_data_flow_analysis():
    p = ssrf_agent.PROMPT.lower()
    assert "data-flow" in p or "data flow" in p
    assert "ssrf" in p or "server-side request forgery" in p


def test_default_llm_fn():
    assert ssrf_agent.LLM_ANALYZE_FN is default_llm_analyze


@pytest.mark.asyncio
async def test_analyze_tags_hypotheses_with_ssrf_class(monkeypatch):
    async def fake_llm(_files, _prompt):
        return json.dumps(
            [
                {
                    "endpoint": "/api/fetch-url",
                    "param": "url",
                    "reasoning": "user URL fed to outbound HTTP client",
                    "candidate_payloads": ["https://t.test/internal"],
                    "expected_outcome": "server contacts user-supplied host",
                }
            ]
        )

    monkeypatch.setattr(ssrf_agent, "LLM_ANALYZE_FN", fake_llm)
    out = await ssrf_agent.analyze(_ctx_with_surface())
    assert out[0]["vuln_class"] == "ssrf"


@pytest.mark.asyncio
async def test_empty_discovery_returns_empty():
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    assert await ssrf_agent.analyze(c) == []


@pytest.mark.asyncio
async def test_prompt_injection_wrapper_is_consulted(monkeypatch):
    captured: dict = {}

    async def fake_llm(files, prompt):
        captured["files"] = list(files)
        captured["prompt"] = prompt
        return "[]"

    monkeypatch.setattr(ssrf_agent, "LLM_ANALYZE_FN", fake_llm)
    await ssrf_agent.analyze(_ctx_with_surface())
    assert [p for p, _ in captured["files"]] == ["scan_context.json"]
    assert captured["prompt"] == ssrf_agent.PROMPT
