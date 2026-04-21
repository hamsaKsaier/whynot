"""Auth agent — authentication weaknesses.

Reasons about session handling, credential storage, password-reset flows,
multi-factor enforcement, and the strength of authentication-token
generation. Distinct from the authz agent which focuses on access-control
checks on already-authenticated requests.
"""

from __future__ import annotations

from app.agents import LLMAnalyzeFn, default_llm_analyze, run_agent
from app.phases.context import PhaseContext

VULN_CLASS = "auth"

PROMPT = (
    "You are analyzing an authorized security scan for authentication "
    "weaknesses. Consider login and password-reset endpoints, session "
    "cookies (flags, entropy, expiry), token issuance paths, multi-factor "
    "enforcement gaps, credential-enumeration signals (timing, error "
    "messages), and replay or fixation risks. Focus on how users prove "
    "identity — NOT on what resources they can access afterwards. "
    "Respond ONLY with a JSON array. Each element is an object with keys: "
    '"endpoint" (string), "param" (string or null), "reasoning" (string), '
    '"candidate_payloads" (array of strings), '
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
