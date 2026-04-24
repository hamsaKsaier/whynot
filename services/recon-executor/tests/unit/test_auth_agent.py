"""Unit tests for the phase-3 auth agent."""

from __future__ import annotations

import json

import pytest

import app.agents.auth_agent as auth_agent
from app.agents import default_llm_analyze
from app.phases import PhaseContext


def _ctx_with_surface() -> PhaseContext:
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {
        "endpoints": ["/login", "/reset-password", "/api/me"],
        "categorized_endpoints": {"auth": ["/login", "/reset-password"]},
    }
    c.state["fingerprint"] = {"source_stack": {"auth_library": "passport"}}
    return c


def test_vuln_class_label():
    assert auth_agent.VULN_CLASS == "auth"


def test_prompt_covers_sessions_and_mfa():
    p = auth_agent.PROMPT.lower()
    assert "session" in p
    assert "multi-factor" in p or "mfa" in p
    assert "authentication" in p


def test_default_llm_fn():
    assert auth_agent.LLM_ANALYZE_FN is default_llm_analyze


@pytest.mark.asyncio
async def test_analyze_tags_hypotheses_with_auth_class(monkeypatch):
    async def fake_llm(_files, _prompt):
        return json.dumps(
            [
                {
                    "endpoint": "/login",
                    "param": "username",
                    "reasoning": "credential enumeration via timing",
                    "candidate_payloads": ["known-user", "unknown-user"],
                    "expected_outcome": "response time differs by >50ms",
                }
            ]
        )

    monkeypatch.setattr(auth_agent, "LLM_ANALYZE_FN", fake_llm)
    out = await auth_agent.analyze(_ctx_with_surface())
    assert out[0]["vuln_class"] == "auth"


@pytest.mark.asyncio
async def test_empty_discovery_returns_empty():
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    assert await auth_agent.analyze(c) == []


@pytest.mark.asyncio
async def test_prompt_injection_wrapper_is_consulted(monkeypatch):
    captured: dict = {}

    async def fake_llm(files, prompt):
        captured["files"] = list(files)
        captured["prompt"] = prompt
        return "[]"

    monkeypatch.setattr(auth_agent, "LLM_ANALYZE_FN", fake_llm)
    await auth_agent.analyze(_ctx_with_surface())
    assert [p for p, _ in captured["files"]] == ["scan_context.json"]
    assert captured["prompt"] == auth_agent.PROMPT
