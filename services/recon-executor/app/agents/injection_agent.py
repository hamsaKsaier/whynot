"""Injection agent — SQL / NoSQL / OS command / template injection.

Performs structured data-flow analysis: traces user-controlled inputs
(query params, form fields, request bodies, headers) from sources to
dangerous sinks (database queries, shell exec, template render, eval)
using the Discovery attack surface and Fingerprinting source-stack map.
"""

from __future__ import annotations

from app.agents import LLMAnalyzeFn, default_llm_analyze, run_agent
from app.phases.context import PhaseContext

VULN_CLASS = "injection"

PROMPT = (
    "You are analyzing an authorized security scan. Identify SQL, NoSQL, "
    "OS command, and template injection vulnerabilities. Perform structured "
    "data-flow analysis: trace user-controlled inputs (query parameters, "
    "form fields, request bodies, request headers, cookies) from sources "
    "to dangerous sinks (database query builders, raw SQL concatenation, "
    "shell exec, template render calls, eval). "
    "Respond ONLY with a JSON array. Each element is an object with keys: "
    '"endpoint" (string), "param" (string or null), "reasoning" (string — '
    "describe the source-to-sink path), "
    '"candidate_payloads" (array of strings — specific test inputs to try), '
    '"expected_outcome" (string — what response behaviour proves '
    "exploitation). No prose outside the JSON array."
)

LLM_ANALYZE_FN: LLMAnalyzeFn = default_llm_analyze


async def analyze(ctx: PhaseContext) -> list[dict]:
    return await run_agent(
        vuln_class=VULN_CLASS,
        ctx=ctx,
        prompt=PROMPT,
        llm_fn=LLM_ANALYZE_FN,
    )
