"""Phase 3: Vulnerability analysis — 5 concurrent agent pipelines.

Runs one agent per vulnerability class (injection, xss, ssrf, auth, authz)
in parallel via :func:`asyncio.gather` with ``return_exceptions=True``. A
single agent failure must not fail the whole phase: the phase records the
failing class in ``ctx.state["vuln_analysis_failures"]`` and continues with
the surviving agents' output. The phase raises only if every agent fails.

Output:
  * ``ctx.state["hypotheses"]`` — dict keyed by vuln class, value is a list
    of :class:`~app.agents.Hypothesis` dicts.
  * A JSON artifact persisted via :data:`PERSIST_ARTIFACT_FN`.
  * A ``recon_phase_vuln_analysis`` billing event (unless
    ``suppress_per_phase_billing`` is set).

Findings are NOT emitted here — hypotheses only become ``recon_findings``
rows in phase 4 (exploitation) after the associated payload succeeds with
a reproducible proof-of-concept (recon-safety rule 10).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Awaitable, Callable, Optional

import app.agents.auth_agent as auth_agent
import app.agents.authz_agent as authz_agent
import app.agents.injection_agent as injection_agent
import app.agents.ssrf_agent as ssrf_agent
import app.agents.xss_agent as xss_agent
from app.agents import VULN_CLASSES, Hypothesis, VulnClass

from .context import PhaseContext, PhaseResult

logger = logging.getLogger(__name__)


# ─── Seams (default no-ops; production wiring injects real fns) ──────

PersistArtifactFn = Callable[[str, str, str, dict], Awaitable[Optional[str]]]
EmitBillingFn = Callable[[str, str, int], Awaitable[None]]


async def _default_persist_artifact(
    scan_id: str, phase: str, kind: str, payload: dict
) -> Optional[str]:
    del scan_id, phase, kind, payload
    return None


async def _default_emit_billing(
    workspace_id: str, event_type: str, quantity: int
) -> None:
    del workspace_id, event_type, quantity
    return None


PERSIST_ARTIFACT_FN: PersistArtifactFn = _default_persist_artifact
EMIT_BILLING_FN: EmitBillingFn = _default_emit_billing


# ─── Agent registry ──────────────────────────────────────────────────

AgentFn = Callable[[str, PhaseContext], Awaitable[list[dict]]]


async def _run_injection(vuln_class: str, ctx: PhaseContext) -> list[dict]:
    del vuln_class
    return await injection_agent.analyze(ctx)


async def _run_xss(vuln_class: str, ctx: PhaseContext) -> list[dict]:
    del vuln_class
    return await xss_agent.analyze(ctx)


async def _run_ssrf(vuln_class: str, ctx: PhaseContext) -> list[dict]:
    del vuln_class
    return await ssrf_agent.analyze(ctx)


async def _run_auth(vuln_class: str, ctx: PhaseContext) -> list[dict]:
    del vuln_class
    return await auth_agent.analyze(ctx)


async def _run_authz(vuln_class: str, ctx: PhaseContext) -> list[dict]:
    del vuln_class
    return await authz_agent.analyze(ctx)


AGENTS: dict[str, AgentFn] = {
    "injection": _run_injection,
    "xss": _run_xss,
    "ssrf": _run_ssrf,
    "auth": _run_auth,
    "authz": _run_authz,
}


# ─── Data shape ──────────────────────────────────────────────────────

@dataclass
class VulnAnalysisResult:
    hypotheses: dict[str, list[dict]] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)


# ─── Phase entry point ───────────────────────────────────────────────

async def run(ctx: PhaseContext) -> PhaseResult:
    results: list[Any] = await asyncio.gather(
        *(AGENTS[cls](cls, ctx) for cls in VULN_CLASSES),
        return_exceptions=True,
    )

    hypotheses: dict[str, list[dict]] = {}
    failures: list[str] = []
    errors: list[str] = []
    for cls, res in zip(VULN_CLASSES, results):
        if isinstance(res, BaseException):
            logger.error("vuln_analysis agent failed for %s: %s", cls, res)
            failures.append(cls)
            errors.append(f"{cls}: {res}")
            hypotheses[cls] = []
        else:
            hypotheses[cls] = res

    if len(failures) == len(VULN_CLASSES):
        raise RuntimeError(
            "all vuln-analysis agents failed: " + "; ".join(errors)
        )

    ctx.state["hypotheses"] = hypotheses
    ctx.state["vuln_analysis_failures"] = failures

    artifact = VulnAnalysisResult(hypotheses=hypotheses, failures=failures)
    payload = asdict(artifact)
    artifact_id = await PERSIST_ARTIFACT_FN(
        ctx.scan_id, "vuln_analysis", "json", payload
    )

    if not ctx.state.get("suppress_per_phase_billing"):
        await EMIT_BILLING_FN(
            ctx.workspace_id, "recon_phase_vuln_analysis", 1
        )

    total = sum(len(v) for v in hypotheses.values())
    succeeded = len(VULN_CLASSES) - len(failures)
    return PhaseResult(
        artifact_id=artifact_id,
        summary=f"{total} hypotheses across {succeeded} classes",
    )


__all__ = [
    "AGENTS",
    "EMIT_BILLING_FN",
    "Hypothesis",
    "PERSIST_ARTIFACT_FN",
    "VULN_CLASSES",
    "VulnAnalysisResult",
    "VulnClass",
    "run",
]
