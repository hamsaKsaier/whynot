"""Authz agent — authorization / access-control weaknesses.

Reasons about insecure direct object references (IDOR), missing or
inconsistent role checks, tenant-isolation gaps, and privilege escalation
paths. Assumes requests are already authenticated — this agent focuses on
what an authenticated user is permitted to touch.
"""

from __future__ import annotations

from app.agents import LLMAnalyzeFn, default_llm_analyze, run_agent
from app.phases.context import PhaseContext

VULN_CLASS = "authz"

PROMPT = (
    "You are analyzing an authorized security scan for authorization and "
    "access-control weaknesses. Consider insecure direct object references "
    "(IDOR) — endpoints that look up records by a user-supplied identifier "
    "without scoping to the caller — missing or inconsistent role checks, "
    "cross-tenant or cross-workspace data leakage, and horizontal or "
    "vertical privilege escalation. Assume requests are already "
    "authenticated; focus on what permissions are enforced. "
    "Respond ONLY with a JSON array. Each element is an object with keys: "
    '"endpoint" (string), "param" (string or null), "reasoning" (string), '
    '"candidate_payloads" (array of strings — specific identifiers or '
    "role-manipulation values to try), "
    '"expected_outcome" (string — what proves exploitation). '
    "No prose outside the JSON array."
)

LLM_ANALYZE_FN: LLMAnalyzeFn = default_llm_analyze


async def analyze(ctx: PhaseContext) -> list[dict]:
    return await run_agent(
        vuln_class=VULN_CLASS,
        ctx=ctx,
        prompt=PROMPT,
        llm_fn=LLM_ANALYZE_FN,
    )
