"""SSRF agent — server-side request forgery.

Performs structured data-flow analysis: traces URL-valued user input
(query params, form fields, JSON bodies) from sources to outbound HTTP
clients (fetch, axios, httpx, requests, url.Open). Flags any sink that
accepts a user-provided URL without allow-listing.
"""

from __future__ import annotations

from app.agents import LLMAnalyzeFn, default_llm_analyze, run_agent
from app.phases.context import PhaseContext

VULN_CLASS = "ssrf"

PROMPT = (
    "You are analyzing an authorized security scan for server-side request "
    "forgery. Perform structured data-flow analysis: trace URL-valued user "
    "inputs (query parameters, form fields, JSON body fields, webhook "
    "targets) from sources to outbound HTTP client calls or URL-fetching "
    "sinks. Prioritize endpoints where the host, scheme, or path comes from "
    "user input without allow-listing. "
    "Respond ONLY with a JSON array. Each element is an object with keys: "
    '"endpoint" (string), "param" (string or null), "reasoning" (string — '
    'describe the source-to-sink URL flow), "candidate_payloads" (array of '
    "strings — specific test URLs to try, scoped to the authorized target "
    "only; do NOT include payloads that target real external services), "
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
