"""Unit tests for the phase-3 authz agent."""

from __future__ import annotations

import json

import pytest

import app.agents.authz_agent as authz_agent
from app.agents import default_llm_analyze
from app.phases import PhaseContext


def _ctx_with_surface() -> PhaseContext:
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {
        "endpoints": ["/api/users/1", "/api/admin/stats", "/api/workspaces/42"],
    }
    c.state["fingerprint"] = {"source_stack": {"framework": "express"}}
    return c


def test_vuln_class_label():
    assert authz_agent.VULN_CLASS == "authz"


def test_prompt_covers_idor_and_tenant_isolation():
    p = authz_agent.PROMPT.lower()
    assert "idor" in p or "insecure direct object" in p
    assert "tenant" in p or "workspace" in p
    assert "privilege escalation" in p


def test_default_llm_fn():
    assert authz_agent.LLM_ANALYZE_FN is default_llm_analyze


@pytest.mark.asyncio
async def test_analyze_tags_hypotheses_with_authz_class(monkeypatch):
    async def fake_llm(_files, _prompt):
        return json.dumps(
            [
                {
                    "endpoint": "/api/users/{id}",
                    "param": "id",
                    "reasoning": "looks up by id without ownership check",
                    "candidate_payloads": ["1", "2", "9999"],
                    "expected_outcome": "returns another user's record",
                }
            ]
        )

    monkeypatch.setattr(authz_agent, "LLM_ANALYZE_FN", fake_llm)
    out = await authz_agent.analyze(_ctx_with_surface())
    assert out[0]["vuln_class"] == "authz"


@pytest.mark.asyncio
async def test_empty_discovery_returns_empty():
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    assert await authz_agent.analyze(c) == []


@pytest.mark.asyncio
async def test_prompt_injection_wrapper_is_consulted(monkeypatch):
    captured: dict = {}

    async def fake_llm(files, prompt):
        captured["files"] = list(files)
        captured["prompt"] = prompt
        return "[]"

    monkeypatch.setattr(authz_agent, "LLM_ANALYZE_FN", fake_llm)
    await authz_agent.analyze(_ctx_with_surface())
    assert [p for p, _ in captured["files"]] == ["scan_context.json"]
    assert captured["prompt"] == authz_agent.PROMPT
