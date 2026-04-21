"""Per-vuln-class analysis agents for phase 3 (vulnerability analysis).

Each agent consumes the Discovery attack-surface map and the Fingerprinting
source-code map, reasons over them via an LLM call, and emits a list of
hypothesized exploitable paths. Real exploits are NOT attempted here — that
is phase 4. Every LLM call that ingests scanned repo content routes through
the prompt-injection wrapper in :mod:`app.safety` (recon-safety rule 4).

Agents share :func:`run_agent` which packages the common shape (pull state,
invoke LLM through the wrapper, parse JSON, validate into
:class:`Hypothesis` dicts). Per-class modules only contribute the
class-specific prompt and identifier, plus a swap-able ``LLM_ANALYZE_FN``
seam so tests can substitute the LLM without touching the helper.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Awaitable, Callable, Iterable, Literal, Optional

from app.phases.context import PhaseContext
from app.safety import build_safe_messages

logger = logging.getLogger(__name__)

VulnClass = Literal["injection", "xss", "ssrf", "auth", "authz"]

VULN_CLASSES: tuple[VulnClass, ...] = (
    "injection",
    "xss",
    "ssrf",
    "auth",
    "authz",
)


@dataclass
class Hypothesis:
    """A reasoned exploit candidate emitted by a phase-3 agent.

    ``candidate_payloads`` are specific test inputs that the exploitation
    phase (C4) will attempt. ``expected_outcome`` is a short string
    describing what response behaviour would confirm the vulnerability.
    """

    vuln_class: VulnClass
    endpoint: str
    param: Optional[str]
    reasoning: str
    candidate_payloads: list[str] = field(default_factory=list)
    expected_outcome: str = ""


LLMAnalyzeFn = Callable[[Iterable[tuple[str, str]], str], Awaitable[str]]


async def default_llm_analyze(
    files: Iterable[tuple[str, str]], user_prompt: str
) -> str:
    """Default LLM seam used when no real client is injected.

    Still invokes :func:`app.safety.build_safe_messages` so the
    prompt-injection wrapper is exercised on the default code path (rule 4).
    """
    build_safe_messages(files, user_prompt)
    return "[]"


async def run_agent(
    *,
    vuln_class: VulnClass,
    ctx: PhaseContext,
    prompt: str,
    llm_fn: LLMAnalyzeFn,
) -> list[dict]:
    """Shared agent body: pull state, call the LLM through the prompt-
    injection wrapper, and parse the JSON response into ``Hypothesis`` dicts.

    Degrades gracefully on any LLM or parse failure by returning ``[]`` so
    per-agent errors never crash the phase (recon-safety rule: one agent
    failing must not fail the phase).
    """
    surface = ctx.state.get("attack_surface") or {}
    fingerprint = ctx.state.get("fingerprint") or {}
    endpoints = surface.get("endpoints") or []
    if not endpoints:
        return []
    context_doc = json.dumps(
        {
            "attack_surface": surface,
            "source_stack": fingerprint.get("source_stack") or {},
        },
        indent=2,
    )
    files: list[tuple[str, str]] = [("scan_context.json", context_doc)]
    try:
        raw = await llm_fn(files, prompt)
    except Exception as e:  # noqa: BLE001 — degrade; caller tolerates failure
        logger.warning("%s agent LLM call failed: %s", vuln_class, e)
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    out: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        endpoint = item.get("endpoint")
        if not isinstance(endpoint, str) or not endpoint:
            continue
        raw_param = item.get("param")
        param = raw_param if isinstance(raw_param, str) else None
        payloads_raw = item.get("candidate_payloads") or []
        if not isinstance(payloads_raw, list):
            payloads_raw = []
        hyp = Hypothesis(
            vuln_class=vuln_class,
            endpoint=endpoint,
            param=param,
            reasoning=str(item.get("reasoning") or ""),
            candidate_payloads=[str(p) for p in payloads_raw],
            expected_outcome=str(item.get("expected_outcome") or ""),
        )
        out.append(asdict(hyp))
    return out


__all__ = [
    "Hypothesis",
    "LLMAnalyzeFn",
    "VULN_CLASSES",
    "VulnClass",
    "default_llm_analyze",
    "run_agent",
]
