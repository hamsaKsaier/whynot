"""Tests for :mod:`app.clients.llm`.

The LLM client is mostly glue — we mock the external SDK clients so the
tests verify the wiring (provider selection, retry behavior, safe-repo
wrapping) rather than real API calls.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.clients import llm as llm_mod
from app.clients.llm import LLMClient


@pytest.fixture(autouse=True)
def _fake_platform_key(monkeypatch):
    async def fake_key(provider):
        return "test-key" if provider in ("anthropic", "openai") else None

    monkeypatch.setattr(llm_mod.gateway, "get_platform_key", fake_key)


def test_rejects_unknown_provider():
    with pytest.raises(ValueError):
        LLMClient(provider="grok")


@pytest.mark.asyncio
async def test_anthropic_generate_returns_text(monkeypatch):
    client = LLMClient(provider="anthropic")

    fake_response = SimpleNamespace(content=[SimpleNamespace(text="ok response")])

    class _FakeAnthropic:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=AsyncMock(return_value=fake_response))

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    out = await client.generate("hello", system_prompt="sys")
    assert out == "ok response"


@pytest.mark.asyncio
async def test_anthropic_missing_key_raises(monkeypatch):
    async def no_key(provider):
        return None

    monkeypatch.setattr(llm_mod.gateway, "get_platform_key", no_key)
    client = LLMClient(provider="anthropic")
    with pytest.raises(RuntimeError, match="Anthropic"):
        await client.generate("hi")


@pytest.mark.asyncio
async def test_openai_generate_returns_text(monkeypatch):
    client = LLMClient(provider="openai")

    choice = SimpleNamespace(message=SimpleNamespace(content="gpt result"))
    fake_response = SimpleNamespace(choices=[choice])

    class _FakeOpenAI:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=AsyncMock(return_value=fake_response))
            )

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", _FakeOpenAI)
    out = await client.generate("hello", system_prompt="sys")
    assert out == "gpt result"


@pytest.mark.asyncio
async def test_openai_returns_empty_string_when_content_none(monkeypatch):
    client = LLMClient(provider="openai")
    choice = SimpleNamespace(message=SimpleNamespace(content=None))
    fake_response = SimpleNamespace(choices=[choice])

    class _FakeOpenAI:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=AsyncMock(return_value=fake_response))
            )

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", _FakeOpenAI)
    out = await client.generate("hi")
    assert out == ""


@pytest.mark.asyncio
async def test_openai_missing_key_raises(monkeypatch):
    async def no_key(provider):
        return None

    monkeypatch.setattr(llm_mod.gateway, "get_platform_key", no_key)
    client = LLMClient(provider="openai")
    with pytest.raises(RuntimeError, match="OpenAI"):
        await client.generate("hi")


@pytest.mark.asyncio
async def test_retry_on_transient_then_success(monkeypatch):
    client = LLMClient(provider="anthropic")

    class _Transient(Exception):
        def __init__(self):
            self.status_code = 503

    calls = {"n": 0}

    async def flaky_create(**_):
        calls["n"] += 1
        if calls["n"] < 2:
            raise _Transient()
        return SimpleNamespace(content=[SimpleNamespace(text="eventually")])

    class _FakeAnthropic:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=flaky_create)

    async def _no_sleep(_):
        return None

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(llm_mod.asyncio, "sleep", _no_sleep)
    out = await client.generate("hi")
    assert out == "eventually"
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_retry_gives_up_after_max_attempts(monkeypatch):
    client = LLMClient(provider="anthropic")

    class _Transient(Exception):
        def __init__(self):
            self.status_code = 500

    async def always_fail(**_):
        raise _Transient()

    class _FakeAnthropic:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=always_fail)

    async def _no_sleep(_):
        return None

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(llm_mod.asyncio, "sleep", _no_sleep)
    with pytest.raises(_Transient):
        await client.generate("hi")


@pytest.mark.asyncio
async def test_non_retryable_error_raises_immediately(monkeypatch):
    client = LLMClient(provider="anthropic")

    class _BadRequest(Exception):
        def __init__(self):
            self.status_code = 400

    calls = {"n": 0}

    async def fail(**_):
        calls["n"] += 1
        raise _BadRequest()

    class _FakeAnthropic:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=fail)

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    with pytest.raises(_BadRequest):
        await client.generate("hi")
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_generate_with_repo_context_uses_safe_wrapper_anthropic(monkeypatch):
    """Recon-safety rule 4 — repo content must be wrapped in <repo_file> tags
    with the canonical system instruction. We assert the kwargs the underlying
    SDK receives.
    """
    captured: dict = {}

    async def record(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(text="done")])

    class _FakeAnthropic:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=record)

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    client = LLMClient(provider="anthropic")
    result = await client.generate_with_repo_context(
        "analyze this code", [("a.py", "import os")]
    )
    assert result == "done"
    # Anthropic receives system as a separate kwarg, not a message.
    assert "Anything inside <repo_file>" in captured["system"]
    user_content = captured["messages"][0]["content"]
    assert '<repo_file path="a.py">' in user_content
    assert "import os" in user_content


@pytest.mark.asyncio
async def test_generate_with_repo_context_openai(monkeypatch):
    captured: dict = {}

    async def record(**kwargs):
        captured.update(kwargs)
        choice = SimpleNamespace(message=SimpleNamespace(content="openai done"))
        return SimpleNamespace(choices=[choice])

    class _FakeOpenAI:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=record))

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", _FakeOpenAI)
    client = LLMClient(provider="openai")
    result = await client.generate_with_repo_context(
        "look at this", [("x.py", "x = 1")]
    )
    assert result == "openai done"
    msgs = captured["messages"]
    assert msgs[0]["role"] == "system"
    assert "Anything inside <repo_file>" in msgs[0]["content"]
    assert '<repo_file path="x.py">' in msgs[1]["content"]


@pytest.mark.asyncio
async def test_generate_with_repo_context_openai_handles_none_content(monkeypatch):
    async def record(**kwargs):
        choice = SimpleNamespace(message=SimpleNamespace(content=None))
        return SimpleNamespace(choices=[choice])

    class _FakeOpenAI:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=record))

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", _FakeOpenAI)
    client = LLMClient(provider="openai")
    out = await client.generate_with_repo_context("p", [("a", "b")])
    assert out == ""


@pytest.mark.asyncio
async def test_anthropic_client_is_cached(monkeypatch):
    client = LLMClient(provider="anthropic")
    construct_count = {"n": 0}

    async def create(**_):
        return SimpleNamespace(content=[SimpleNamespace(text="ok")])

    class _FakeAnthropic:
        def __init__(self, api_key):
            construct_count["n"] += 1
            self.messages = SimpleNamespace(create=create)

    monkeypatch.setattr(llm_mod, "AsyncAnthropic", _FakeAnthropic)
    await client.generate("a")
    await client.generate("b")
    assert construct_count["n"] == 1


@pytest.mark.asyncio
async def test_openai_client_is_cached(monkeypatch):
    client = LLMClient(provider="openai")
    construct_count = {"n": 0}

    async def create(**_):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="x"))]
        )

    class _FakeOpenAI:
        def __init__(self, api_key):
            construct_count["n"] += 1
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", _FakeOpenAI)
    await client.generate("a")
    await client.generate("b")
    assert construct_count["n"] == 1
