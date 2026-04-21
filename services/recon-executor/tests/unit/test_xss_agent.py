"""Unit tests for the phase-3 XSS agent."""

from __future__ import annotations

import json

import pytest

import app.agents.xss_agent as xss_agent
from app.agents import default_llm_analyze
from app.phases import PhaseContext


def _ctx_with_surface() -> PhaseContext:
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {"endpoints": ["/search", "/comments"]}
    c.state["fingerprint"] = {"source_stack": {"framework": "express"}}
    return c


def test_vuln_class_label():
    assert xss_agent.VULN_CLASS == "xss"


def test_prompt_covers_reflected_stored_and_dom():
    p = xss_agent.PROMPT.lower()
    assert "reflected" in p
    assert "stored" in p
    assert "dom" in p


def test_default_llm_fn():
    assert xss_agent.LLM_ANALYZE_FN is default_llm_analyze


@pytest.mark.asyncio
async def test_analyze_tags_hypotheses_with_xss_class(monkeypatch):
    async def fake_llm(_files, _prompt):
        return json.dumps(
            [
                {
                    "endpoint": "/search",
                    "param": "q",
                    "reasoning": "echoed into HTML",
                    "candidate_payloads": ["<svg onload=alert(1)>"],
                    "expected_outcome": "payload reflected unescaped",
                }
            ]
        )

    monkeypatch.setattr(xss_agent, "LLM_ANALYZE_FN", fake_llm)
    out = await xss_agent.analyze(_ctx_with_surface())
    assert out[0]["vuln_class"] == "xss"
    assert out[0]["endpoint"] == "/search"


@pytest.mark.asyncio
async def test_empty_discovery_returns_empty():
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    assert await xss_agent.analyze(c) == []


@pytest.mark.asyncio
async def test_prompt_injection_wrapper_is_consulted(monkeypatch):
    captured: dict = {}

    async def fake_llm(files, prompt):
        captured["files"] = list(files)
        captured["prompt"] = prompt
        return "[]"

    monkeypatch.setattr(xss_agent, "LLM_ANALYZE_FN", fake_llm)
    await xss_agent.analyze(_ctx_with_surface())
    assert [p for p, _ in captured["files"]] == ["scan_context.json"]
    assert captured["prompt"] == xss_agent.PROMPT
