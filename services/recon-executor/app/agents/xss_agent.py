"""XSS agent — reflected, stored, and DOM-based cross-site scripting.

Reasons about which endpoints reflect user input into HTML responses or
into the DOM, whether responses carry a restrictive Content-Security-Policy,
and which input vectors are likely to bypass server-side encoding.
"""

from __future__ import annotations

from app.agents import LLMAnalyzeFn, default_llm_analyze, run_agent
from app.phases.context import PhaseContext

VULN_CLASS = "xss"

PROMPT = (
    "You are analyzing an authorized security scan for reflected, stored, "
    "and DOM-based cross-site scripting. Identify endpoints that echo "
    "user-controlled input into HTML, JavaScript, or JSON-with-HTML "
    "responses. Consider sanitization gaps, missing or weak "
    "Content-Security-Policy, dangerous innerHTML / dangerouslySetInnerHTML "
    "sinks, and attribute-context injection. "
    "Respond ONLY with a JSON array. Each element is an object with keys: "
    '"endpoint" (string), "param" (string or null), "reasoning" (string), '
    '"candidate_payloads" (array of strings — specific test payloads to try), '
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
