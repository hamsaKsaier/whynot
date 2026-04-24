"""Async LLM client used by the recon-executor.

Mirrors the surface of the ai-service ``LLMClient`` but intentionally keeps
only the methods the recon pipeline needs. Keys are fetched lazily from the
gateway platform-config endpoint — never from env vars — so the executor can
boot before the admin has configured any provider.

All calls that ingest scanned repo content MUST go through
:meth:`LLMClient.generate_with_repo_context` which internally routes through
the prompt-injection wrapper in :mod:`app.safety`.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Callable, Iterable, Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from app.clients import gateway
from app.safety import SYSTEM_INSTRUCTION, build_safe_messages

logger = logging.getLogger(__name__)

_RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
_MAX_RETRIES = 3


class LLMClient:
    def __init__(self, provider: Optional[str] = None):
        self.provider = (provider or os.getenv("LLM_PROVIDER", "anthropic")).lower()
        if self.provider not in ("openai", "anthropic"):
            raise ValueError(
                f"Unknown LLM_PROVIDER: {self.provider!r}. Expected 'anthropic' or 'openai'."
            )
        self._anthropic: Optional[AsyncAnthropic] = None
        self._openai: Optional[AsyncOpenAI] = None

    async def _ensure_anthropic(self) -> AsyncAnthropic:
        if self._anthropic is not None:
            return self._anthropic
        key = await gateway.get_platform_key("anthropic")
        if not key:
            raise RuntimeError("No Anthropic API key configured in platform admin")
        self._anthropic = AsyncAnthropic(api_key=key)
        return self._anthropic

    async def _ensure_openai(self) -> AsyncOpenAI:
        if self._openai is not None:
            return self._openai
        key = await gateway.get_platform_key("openai")
        if not key:
            raise RuntimeError("No OpenAI API key configured in platform admin")
        self._openai = AsyncOpenAI(api_key=key)
        return self._openai

    async def _with_retry(self, coro_factory: Callable[[], Any]) -> Any:
        for attempt in range(_MAX_RETRIES):  # pragma: no branch
            try:
                return await coro_factory()
            except Exception as e:
                status = getattr(e, "status_code", None) or getattr(
                    getattr(e, "response", None), "status_code", None
                )
                if status in _RETRY_STATUSES and attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise

    async def generate(
        self,
        user_prompt: str,
        *,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> str:
        """Plain text generation. Does NOT include repo context — use
        :meth:`generate_with_repo_context` for that.
        """
        system = system_prompt or ""
        if self.provider == "anthropic":
            client = await self._ensure_anthropic()
            mdl = model or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            resp = await self._with_retry(
                lambda: client.messages.create(
                    model=mdl,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user_prompt}],
                )
            )
            return resp.content[0].text

        client_o = await self._ensure_openai()
        mdl = model or os.getenv("OPENAI_MODEL", "gpt-4")
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_prompt})
        resp = await self._with_retry(
            lambda: client_o.chat.completions.create(
                model=mdl,
                messages=messages,
                temperature=0.3,
                max_tokens=max_tokens,
            )
        )
        return resp.choices[0].message.content or ""

    async def generate_with_repo_context(
        self,
        user_prompt: str,
        repo_files: Iterable[tuple[str, str]],
        *,
        max_tokens: int = 4096,
        model: Optional[str] = None,
    ) -> str:
        """Generate text from a prompt plus untrusted scanned-repo content.

        Uses :func:`app.safety.build_safe_messages` to wrap each file in
        ``<repo_file>`` delimiters and prepend the system instruction. This
        is the ONLY path the recon pipeline should use when feeding repo
        content into an LLM (recon-safety rule 4).
        """
        messages = build_safe_messages(repo_files, user_prompt)
        # Anthropic takes ``system`` as a separate kwarg, not a message.
        system_msg = messages[0]["content"] if messages[0]["role"] == "system" else SYSTEM_INSTRUCTION
        user_messages = [m for m in messages if m["role"] != "system"]

        if self.provider == "anthropic":
            client = await self._ensure_anthropic()
            mdl = model or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            resp = await self._with_retry(
                lambda: client.messages.create(
                    model=mdl,
                    max_tokens=max_tokens,
                    system=system_msg,
                    messages=user_messages,
                )
            )
            return resp.content[0].text

        client_o = await self._ensure_openai()
        mdl = model or os.getenv("OPENAI_MODEL", "gpt-4")
        resp = await self._with_retry(
            lambda: client_o.chat.completions.create(
                model=mdl,
                messages=messages,
                temperature=0.3,
                max_tokens=max_tokens,
            )
        )
        return resp.choices[0].message.content or ""
