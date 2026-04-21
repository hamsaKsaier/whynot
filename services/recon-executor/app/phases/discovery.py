"""Phase 2: Discovery — attack-surface map via headless browser + schemathesis.

Crawls the target starting at the entry URL and follows internal links up to
:data:`MAX_CRAWL_DEPTH`. Supports an optional authenticated-crawl login flow
whose password is always redacted in logs. Parses discovered JS bundles for
``fetch``/``axios`` endpoints and (when available) pulls an OpenAPI spec via
schemathesis. Finally, an LLM correlation pass categorizes endpoints (auth,
data-mutation, file-upload, redirect, other) and produces the final
``DiscoveryResult`` artifact.

All external effects funnel through module-level seams so tests can mock
page fetches, spec retrieval, LLM calls, artifact persistence, and billing.
"""

from __future__ import annotations

import json
import logging
import re
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Awaitable, Callable, Iterable, Optional
from urllib.parse import urljoin, urlparse

from app.safety import build_safe_messages

from .context import PhaseContext, PhaseResult

logger = logging.getLogger(__name__)


MAX_CRAWL_DEPTH = 3


# ─── Seams ──────────────────────────────────────────────────────────

FetchPageFn = Callable[[str, Optional[dict]], Awaitable[dict]]
FetchOpenAPIFn = Callable[[str], Awaitable[Optional[dict]]]
LLMCorrelateFn = Callable[[Iterable[tuple[str, str]], str], Awaitable[str]]
PersistArtifactFn = Callable[[str, str, str, dict], Awaitable[Optional[str]]]
EmitBillingFn = Callable[[str, str, int], Awaitable[None]]


async def _default_fetch_page(url: str, auth_session: Optional[dict]) -> dict:
    del auth_session
    return {"url": url, "links": [], "forms": [], "js_bundles": []}


async def _default_fetch_openapi(host: str) -> Optional[dict]:
    del host
    return None


async def _default_llm_correlate(
    files: Iterable[tuple[str, str]], user_prompt: str
) -> str:
    build_safe_messages(files, user_prompt)
    return "{}"


async def _default_persist_artifact(
    scan_id: str, phase: str, kind: str, payload: dict
) -> Optional[str]:
    del scan_id, phase, kind, payload
    return None


async def _default_emit_billing(workspace_id: str, event_type: str, quantity: int) -> None:
    del workspace_id, event_type, quantity
    return None


FETCH_PAGE_FN: FetchPageFn = _default_fetch_page
FETCH_OPENAPI_FN: FetchOpenAPIFn = _default_fetch_openapi
LLM_CORRELATE_FN: LLMCorrelateFn = _default_llm_correlate
PERSIST_ARTIFACT_FN: PersistArtifactFn = _default_persist_artifact
EMIT_BILLING_FN: EmitBillingFn = _default_emit_billing


# ─── Data shape ─────────────────────────────────────────────────────

@dataclass
class DiscoveryResult:
    target_url: str
    crawled_urls: list[str] = field(default_factory=list)
    forms: list[dict] = field(default_factory=list)
    js_endpoints: list[str] = field(default_factory=list)
    openapi_endpoints: list[dict] = field(default_factory=list)
    categorized_endpoints: dict[str, list[str]] = field(default_factory=dict)
    authenticated: bool = False


# ─── Crawling ───────────────────────────────────────────────────────

def _same_origin(url: str, base: str) -> bool:
    u, b = urlparse(url), urlparse(base)
    if not u.netloc:
        return True
    return u.netloc == b.netloc


def _redact_login_flow(login_flow: dict) -> dict:
    """Return a copy of ``login_flow`` with any password-like field masked.

    Used for log emission (recon-safety rule 3): authenticated-crawl logs
    must never include the raw password.
    """
    sensitive_keys = {"password", "passwd", "secret", "token", "api_key", "apiKey"}
    return {
        k: ("[REDACTED]" if k in sensitive_keys else v) for k, v in login_flow.items()
    }


async def _authenticate(login_flow: dict) -> dict:
    """Drive the supplied login flow and return an auth session dict.

    The default implementation is a stub — the recon-executor Docker image
    carries Playwright and the real driver is injected via monkeypatch in
    integration tests. This function never logs the raw password.
    """
    logger.info("authenticated crawl: driving login flow %s", _redact_login_flow(login_flow))
    return {"cookies": {}, "headers": {}}


async def _crawl(entry_url: str, *, auth_session: Optional[dict] = None) -> dict:
    """BFS crawl from ``entry_url`` up to :data:`MAX_CRAWL_DEPTH` levels deep.

    Stops following links once depth exceeds :data:`MAX_CRAWL_DEPTH`, even if
    additional in-scope links are discovered at deeper levels. Returns a dict
    with flat lists of URLs, forms, and JS bundle URLs.
    """
    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(entry_url, 0)])
    crawled: list[str] = []
    forms: list[dict] = []
    bundles: set[str] = set()

    while queue:
        url, depth = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        page = await FETCH_PAGE_FN(url, auth_session)
        crawled.append(url)
        for form in page.get("forms", []):
            forms.append({"url": url, **form})
        for bundle in page.get("js_bundles", []):
            bundles.add(bundle)

        if depth >= MAX_CRAWL_DEPTH:
            continue
        for link in page.get("links", []):
            absolute = urljoin(url, link)
            if not _same_origin(absolute, entry_url):
                continue
            if absolute not in visited:
                queue.append((absolute, depth + 1))

    return {"urls": crawled, "forms": forms, "js_bundles": sorted(bundles)}


# ─── JS bundle → endpoint extraction ────────────────────────────────

_FETCH_CALL_RE = re.compile(r"""fetch\(\s*['"`]([^'"`]+)['"`]""")
_AXIOS_CALL_RE = re.compile(r"""axios\s*\.\s*\w+\s*\(\s*['"`]([^'"`]+)['"`]""")
_XHR_OPEN_RE = re.compile(
    r"""\.open\s*\(\s*['"`][A-Z]+['"`]\s*,\s*['"`]([^'"`]+)['"`]"""
)


def _extract_endpoints_from_js(source: str) -> list[str]:
    found: list[str] = []
    for pattern in (_FETCH_CALL_RE, _AXIOS_CALL_RE, _XHR_OPEN_RE):
        for match in pattern.findall(source):
            if match not in found:
                found.append(match)
    return found


async def _collect_js_endpoints(bundle_urls: Iterable[str]) -> list[str]:
    """Fetch each JS bundle (as a page) and extract endpoint strings."""
    endpoints: list[str] = []
    for url in bundle_urls:
        page = await FETCH_PAGE_FN(url, None)
        body = page.get("body", "") or ""
        for ep in _extract_endpoints_from_js(body):
            if ep not in endpoints:
                endpoints.append(ep)
    return endpoints


# ─── LLM correlation ────────────────────────────────────────────────

CATEGORIES = ("auth", "data_mutation", "file_upload", "redirect", "other")

CORRELATE_PROMPT = (
    "You are categorizing endpoints discovered during an authorized "
    "security scan. Classify each endpoint into exactly one of: "
    "auth, data_mutation, file_upload, redirect, other. "
    'Respond ONLY with a JSON object of shape {"auth": [...], '
    '"data_mutation": [...], "file_upload": [...], "redirect": [...], '
    '"other": [...]}. No prose.'
)


def _empty_categories() -> dict[str, list[str]]:
    return {cat: [] for cat in CATEGORIES}


async def _correlate(fingerprint: dict, endpoints: list[str]) -> dict[str, list[str]]:
    if not endpoints:
        return _empty_categories()
    doc = json.dumps({"fingerprint": fingerprint, "endpoints": endpoints}, indent=2)
    files: list[tuple[str, str]] = [("scan_context.json", doc)]
    try:
        raw = await LLM_CORRELATE_FN(files, CORRELATE_PROMPT)
    except Exception as e:  # noqa: BLE001
        logger.warning("endpoint correlation failed: %s", e)
        return _empty_categories()
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return _empty_categories()
    return {cat: list(parsed.get(cat, []) or []) for cat in CATEGORIES}


# ─── Phase entry point ──────────────────────────────────────────────

async def run(ctx: PhaseContext) -> PhaseResult:
    target = ctx.target_url
    login_flow = ctx.state.get("login_flow")
    auth_session: Optional[dict] = None
    authenticated = False
    if login_flow:
        auth_session = await _authenticate(login_flow)
        authenticated = True

    crawl_output = await _crawl(target, auth_session=auth_session)

    js_endpoints = await _collect_js_endpoints(crawl_output["js_bundles"])

    host = urlparse(target).hostname or target
    openapi_doc = await FETCH_OPENAPI_FN(host)
    openapi_endpoints: list[dict] = []
    if openapi_doc:
        for path, methods in openapi_doc.get("paths", {}).items():
            for method in methods.keys():
                openapi_endpoints.append({"method": method.upper(), "path": path})

    all_endpoints = list(js_endpoints) + [ep["path"] for ep in openapi_endpoints]
    categorized = await _correlate(ctx.state.get("fingerprint", {}), all_endpoints)

    result = DiscoveryResult(
        target_url=target,
        crawled_urls=crawl_output["urls"],
        forms=crawl_output["forms"],
        js_endpoints=js_endpoints,
        openapi_endpoints=openapi_endpoints,
        categorized_endpoints=categorized,
        authenticated=authenticated,
    )
    payload = asdict(result)
    payload["endpoints"] = all_endpoints
    ctx.state["attack_surface"] = payload

    artifact_id = await PERSIST_ARTIFACT_FN(ctx.scan_id, "discovery", "json", payload)

    if not ctx.state.get("suppress_per_phase_billing"):
        await EMIT_BILLING_FN(ctx.workspace_id, "recon_phase_discovery", 1)

    return PhaseResult(
        artifact_id=artifact_id,
        summary=(
            f"{len(crawl_output['urls'])} URLs crawled, "
            f"{len(all_endpoints)} endpoints discovered"
        ),
    )
