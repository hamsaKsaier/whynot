"""Unit tests for the phase-3 injection agent.

This file also exercises the full range of ``app.agents.run_agent`` branches
— every per-class agent funnels through the same helper, so covering its
edge cases here keeps the other four agent test files focused on class-
specific assertions.
"""

from __future__ import annotations

import json

import pytest

import app.agents.injection_agent as injection_agent
from app.agents import default_llm_analyze
from app.phases import PhaseContext


def _ctx_with_surface() -> PhaseContext:
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {
        "endpoints": ["/api/users", "/api/items"],
        "categorized_endpoints": {"other": ["/api/users"]},
    }
    c.state["fingerprint"] = {"source_stack": {"orm": "sqlalchemy"}}
    return c


# ─── Class identity ──────────────────────────────────────────────────


def test_vuln_class_label():
    assert injection_agent.VULN_CLASS == "injection"


def test_prompt_mentions_injection_and_data_flow():
    p = injection_agent.PROMPT
    assert "injection" in p.lower()
    assert "data-flow" in p.lower() or "data flow" in p.lower()
    assert "JSON array" in p


def test_default_llm_fn_is_prompt_injection_hardened():
    assert injection_agent.LLM_ANALYZE_FN is default_llm_analyze


# ─── Happy path ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analyze_returns_hypothesis_with_correct_vuln_class(monkeypatch):
    async def fake_llm(files, prompt):
        return json.dumps(
            [
                {
                    "endpoint": "/api/users",
                    "param": "id",
                    "reasoning": "raw concatenation into SQL",
                    "candidate_payloads": ["1 OR 1=1"],
                    "expected_outcome": "all rows returned",
                }
            ]
        )

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", fake_llm)
    out = await injection_agent.analyze(_ctx_with_surface())
    assert len(out) == 1
    assert out[0]["vuln_class"] == "injection"
    assert out[0]["endpoint"] == "/api/users"
    assert out[0]["param"] == "id"
    assert out[0]["candidate_payloads"] == ["1 OR 1=1"]


@pytest.mark.asyncio
async def test_analyze_passes_context_through_injection_wrapper(monkeypatch):
    captured: dict = {}

    async def fake_llm(files, prompt):
        captured["files"] = list(files)
        captured["prompt"] = prompt
        return "[]"

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", fake_llm)
    await injection_agent.analyze(_ctx_with_surface())
    # run_agent wraps the context into a single scan_context.json file so
    # the shared prompt-injection hardener (build_safe_messages) sees it.
    paths = [p for p, _ in captured["files"]]
    assert paths == ["scan_context.json"]
    assert captured["prompt"] == injection_agent.PROMPT


# ─── Empty discovery ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empty_discovery_returns_empty_list(monkeypatch):
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")

    async def boom(files, prompt):
        raise AssertionError("LLM must not be called when no endpoints")

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", boom)
    assert await injection_agent.analyze(c) == []


@pytest.mark.asyncio
async def test_empty_endpoints_list_returns_empty(monkeypatch):
    c = PhaseContext(scan_id="s1", workspace_id="ws", target_url="https://t.test")
    c.state["attack_surface"] = {"endpoints": []}

    async def boom(files, prompt):
        raise AssertionError("LLM must not be called when endpoints list is empty")

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", boom)
    assert await injection_agent.analyze(c) == []


# ─── run_agent edge cases ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_llm_raises_is_graceful(monkeypatch):
    async def boom(files, prompt):
        raise RuntimeError("llm 500")

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", boom)
    assert await injection_agent.analyze(_ctx_with_surface()) == []


@pytest.mark.asyncio
async def test_llm_returns_invalid_json_is_graceful(monkeypatch):
    async def bad(files, prompt):
        return "not json at all"

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", bad)
    assert await injection_agent.analyze(_ctx_with_surface()) == []


@pytest.mark.asyncio
async def test_llm_returns_non_list_is_graceful(monkeypatch):
    async def obj(files, prompt):
        return json.dumps({"not": "a list"})

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", obj)
    assert await injection_agent.analyze(_ctx_with_surface()) == []


@pytest.mark.asyncio
async def test_items_without_endpoint_skipped(monkeypatch):
    async def partial(files, prompt):
        return json.dumps(
            [
                {"reasoning": "missing endpoint"},
                {"endpoint": "", "reasoning": "empty endpoint"},
                {"endpoint": 42, "reasoning": "wrong type"},
                "not-a-dict",
                {
                    "endpoint": "/api/good",
                    "param": "id",
                    "reasoning": "real one",
                    "candidate_payloads": ["1'--"],
                    "expected_outcome": "sql error",
                },
            ]
        )

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", partial)
    out = await injection_agent.analyze(_ctx_with_surface())
    assert len(out) == 1
    assert out[0]["endpoint"] == "/api/good"


@pytest.mark.asyncio
async def test_param_non_string_coerced_to_none(monkeypatch):
    async def fake(files, prompt):
        return json.dumps(
            [
                {"endpoint": "/a", "param": 123},
                {"endpoint": "/b", "param": None},
                {"endpoint": "/c"},  # param missing entirely
            ]
        )

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", fake)
    out = await injection_agent.analyze(_ctx_with_surface())
    assert [h["param"] for h in out] == [None, None, None]


@pytest.mark.asyncio
async def test_candidate_payloads_non_list_coerced_to_empty(monkeypatch):
    async def fake(files, prompt):
        return json.dumps(
            [
                {"endpoint": "/a", "candidate_payloads": "not a list"},
                {"endpoint": "/b", "candidate_payloads": None},
                {"endpoint": "/c", "candidate_payloads": [1, 2, "three"]},
            ]
        )

    monkeypatch.setattr(injection_agent, "LLM_ANALYZE_FN", fake)
    out = await injection_agent.analyze(_ctx_with_surface())
    assert out[0]["candidate_payloads"] == []
    assert out[1]["candidate_payloads"] == []
    assert out[2]["candidate_payloads"] == ["1", "2", "three"]


# ─── default_llm_analyze direct coverage ─────────────────────────────


@pytest.mark.asyncio
async def test_default_llm_analyze_returns_empty_json_array():
    out = await default_llm_analyze([("file.py", "x = 1")], "prompt")
    assert out == "[]"


@pytest.mark.asyncio
async def test_default_llm_analyze_exercises_safe_wrapper_on_empty_files():
    # Empty iterable still builds a safe message list (wrapper consulted).
    out = await default_llm_analyze([], "prompt")
    assert out == "[]"
