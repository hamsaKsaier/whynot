"""Phase 5: reporting — consolidate confirmed findings into the final report.

This phase runs last in the recon pipeline. It loads every row from
``recon_findings`` for the scan, partitions them into confirmed (with a
non-null ``proof_of_concept`` per recon-safety rule 10) and
discarded / false-positive, renders a localised Markdown report, runs the
mandatory scrubbers (banned vocabulary per recon-safety rule 6 and
unverifiable CVE numbers), optionally renders a PDF, upserts into
``recon_reports`` (``scan_id`` is unique), and emits a single
``recon_scan_run`` PAYG event — not the per-phase ``recon_phase_reporting``
event, since the full pipeline has now completed.

Every I/O call is injected through a module-level seam so unit tests can
mock the DB, the PDF renderer, and the LLM without touching network.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from .context import PhaseContext, PhaseResult

logger = logging.getLogger(__name__)


# ─── Seams (defaults are no-ops; production wiring injects real fns) ────

LoadFindingsFn = Callable[[str], Awaitable[list[dict[str, Any]]]]
LoadAuthorizationFn = Callable[[str], Awaitable[Optional[dict[str, Any]]]]
LoadScanMetaFn = Callable[[str], Awaitable[dict[str, Any]]]
PersistReportFn = Callable[
    [str, str, dict[str, Any], Optional[str]], Awaitable[Optional[str]]
]
LLMScrubFn = Callable[[str, list[dict[str, Any]]], Awaitable[str]]
RenderPdfFn = Callable[[str], Awaitable[Optional[str]]]
EmitBillingFn = Callable[[str, str, int], Awaitable[None]]


async def _default_load_findings(scan_id: str) -> list[dict[str, Any]]:
    del scan_id
    return []


async def _default_load_authorization(scan_id: str) -> Optional[dict[str, Any]]:
    del scan_id
    return None


async def _default_load_scan_meta(scan_id: str) -> dict[str, Any]:
    del scan_id
    return {}


async def _default_persist_report(
    scan_id: str,
    markdown: str,
    summary: dict[str, Any],
    pdf_url: Optional[str],
) -> Optional[str]:
    del scan_id, markdown, summary, pdf_url
    return None


async def _default_llm_scrub(
    markdown: str, findings: list[dict[str, Any]]
) -> str:
    del findings
    return markdown


async def _default_render_pdf(markdown: str) -> Optional[str]:
    del markdown
    return None


async def _default_emit_billing(
    workspace_id: str, event_type: str, quantity: int
) -> None:
    del workspace_id, event_type, quantity
    return None


LOAD_FINDINGS_FN: LoadFindingsFn = _default_load_findings
LOAD_AUTHORIZATION_FN: LoadAuthorizationFn = _default_load_authorization
LOAD_SCAN_META_FN: LoadScanMetaFn = _default_load_scan_meta
PERSIST_REPORT_FN: PersistReportFn = _default_persist_report
LLM_SCRUB_FN: LLMScrubFn = _default_llm_scrub
RENDER_PDF_FN: RenderPdfFn = _default_render_pdf
EMIT_BILLING_FN: EmitBillingFn = _default_emit_billing


# ─── Banned vocabulary scrubber (recon-safety rule 6) ────────────────

BANNED_VOCAB: tuple[str, ...] = (
    "Shannon",
    "KeygraphHQ",
    "nmap",
    "subfinder",
    "whatweb",
    "schemathesis",
    "Playwright",
    "Anthropic",
    "Claude",
)

_BANNED_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(tok) for tok in BANNED_VOCAB) + r")\b",
    re.IGNORECASE,
)

_CVE_RE = re.compile(r"CVE-\d{4}-\d{4,}")


def _scrub_banned_vocabulary(markdown: str) -> str:
    """Replace every banned-vocab match with ``[REDACTED]`` (case-insensitive)."""
    return _BANNED_RE.sub("[REDACTED]", markdown)


def _collect_known_cves(findings: list[dict[str, Any]]) -> set[str]:
    """Harvest CVE identifiers mentioned by any finding's metadata.

    Looks at ``proof_of_concept`` (structured dict may carry a ``cve`` key)
    and at the finding-level ``cves`` list, if any.
    """
    known: set[str] = set()
    for f in findings:
        poc = f.get("proof_of_concept")
        if isinstance(poc, dict):
            single = poc.get("cve")
            if isinstance(single, str):
                known.add(single.upper())
            multi = poc.get("cves")
            if isinstance(multi, (list, tuple)):
                known.update(str(c).upper() for c in multi if isinstance(c, str))
        listed = f.get("cves")
        if isinstance(listed, (list, tuple)):
            known.update(str(c).upper() for c in listed if isinstance(c, str))
    return known


def _scrub_unverified_cves(markdown: str, known: set[str]) -> str:
    """Replace any ``CVE-YYYY-NNNN`` that isn't in ``known`` with a stable token."""

    def repl(match: re.Match[str]) -> str:
        cve = match.group(0).upper()
        return cve if cve in known else "[REDACTED-CVE]"

    return _CVE_RE.sub(repl, markdown)


async def _scrub_markdown(
    markdown: str, findings: list[dict[str, Any]]
) -> str:
    """Run deterministic scrubbers then the LLM hallucination pass.

    The deterministic pass is authoritative: banned vocabulary and
    unverifiable CVE numbers are removed regardless of what the LLM returns.
    If the LLM call fails we keep the deterministic result.
    """
    markdown = _scrub_banned_vocabulary(markdown)
    markdown = _scrub_unverified_cves(markdown, _collect_known_cves(findings))
    try:
        markdown = await LLM_SCRUB_FN(markdown, findings)
    except Exception as e:  # noqa: BLE001 — scrubber must never block report persistence
        logger.warning("LLM hallucination scrub failed: %s", e)
        return markdown
    # Re-run deterministic passes in case the LLM reintroduced a banned term.
    markdown = _scrub_banned_vocabulary(markdown)
    markdown = _scrub_unverified_cves(markdown, _collect_known_cves(findings))
    return markdown


# ─── Sorting / summary helpers ───────────────────────────────────────

_SEVERITY_ORDER: dict[str, int] = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def _severity_rank(finding: dict[str, Any]) -> tuple[int, int]:
    sev = (finding.get("severity") or "low").lower()
    primary = _SEVERITY_ORDER.get(sev, 99)
    total = (
        (finding.get("impact_score") or 0)
        + (finding.get("exploitability_score") or 0)
        + (finding.get("blast_radius_score") or 0)
    )
    return (primary, -total)


def _sort_confirmed(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(findings, key=_severity_rank)


def _build_summary(confirmed: list[dict[str, Any]]) -> dict[str, Any]:
    by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_class: dict[str, int] = {}
    for f in confirmed:
        sev = (f.get("severity") or "low").lower()
        by_severity[sev] = by_severity.get(sev, 0) + 1
        cls = f.get("vuln_class") or "unknown"
        by_class[cls] = by_class.get(cls, 0) + 1
    return {
        "total": len(confirmed),
        "by_severity": by_severity,
        "by_class": by_class,
    }


# ─── Template rendering ─────────────────────────────────────────────

SUPPORTED_LOCALES: tuple[str, ...] = ("en", "ar", "fr", "de", "es")
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _resolve_locale(locale: Optional[str]) -> str:
    if locale and locale in SUPPORTED_LOCALES:
        return locale
    return "en"


def _load_template(locale: str) -> str:
    path = _TEMPLATES_DIR / f"report.{locale}.md"
    return path.read_text(encoding="utf-8")


def _substitute(template: str, values: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        return values.get(match.group(1), match.group(0))

    return _PLACEHOLDER_RE.sub(repl, template)


def _format_poc(poc: Any) -> str:
    """Render a structured PoC dict as a fenced code block."""
    if poc is None:
        return "```\n(no proof of concept)\n```"
    if isinstance(poc, dict):
        kind = poc.get("kind") or "poc"
        body = poc.get("request") or poc.get("payload") or poc.get("body") or ""
        if not isinstance(body, str):
            body = repr(body)
        return f"```\n# kind={kind}\n{body}\n```"
    return f"```\n{poc}\n```"


def _render_findings_section(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "_0 confirmed findings._\n"
    blocks: list[str] = []
    for f in findings:
        severity = (f.get("severity") or "low").title()
        vuln_class = f.get("vuln_class") or "unknown"
        endpoint = f.get("normalized_endpoint") or f.get("endpoint") or "-"
        impact = f.get("impact_score") or 0
        exp = f.get("exploitability_score") or 0
        blast = f.get("blast_radius_score") or 0
        description = f.get("description") or ""
        remediation = f.get("remediation") or ""
        reproduction = f.get("reproduction_steps") or description
        poc_block = _format_poc(f.get("proof_of_concept"))
        blocks.append(
            f"### {severity} — {vuln_class} on {endpoint}\n"
            f"**Severity score:** Impact {impact}/4, "
            f"Exploitability {exp}/4, Blast radius {blast}/4\n"
            f"**Description:** {description}\n"
            f"**Proof of concept:**\n{poc_block}\n"
            f"**Reproducibility steps:** {reproduction}\n"
            f"**Recommended remediation:** {remediation}\n"
        )
    return "\n".join(blocks)


def _render_discarded_table(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "_No discarded hypotheses._\n"
    rows = ["| Class | Endpoint | Status |", "|---|---|---|"]
    for f in findings:
        cls = f.get("vuln_class") or "unknown"
        endpoint = f.get("normalized_endpoint") or f.get("endpoint") or "-"
        status = f.get("status") or "discarded_unprovable"
        rows.append(f"| {cls} | {endpoint} | {status} |")
    return "\n".join(rows) + "\n"


def _render_top_risks(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "- _No confirmed risks._"
    lines: list[str] = []
    for f in findings[:3]:
        severity = (f.get("severity") or "low").title()
        vuln_class = f.get("vuln_class") or "unknown"
        endpoint = f.get("normalized_endpoint") or f.get("endpoint") or "-"
        lines.append(f"- **{severity}** {vuln_class} on {endpoint}")
    return "\n".join(lines)


def _render_authorization_block(auth: Optional[dict[str, Any]]) -> str:
    if not auth:
        return "_No authorization record linked to this scan._"
    by = auth.get("acknowledged_by") or auth.get("acknowledged_by_user_id") or "-"
    at_raw = auth.get("acknowledged_at")
    at = _format_datetime(at_raw) if at_raw else "-"
    justification = auth.get("justification") or ""
    ip = auth.get("caller_ip") or "-"
    ua = auth.get("user_agent") or "-"
    return (
        f"- Acknowledged by: {by}\n"
        f"- Acknowledged at: {at}\n"
        f"- Caller IP: {ip}\n"
        f"- User agent: {ua}\n"
        f"- Justification: {justification}\n"
    )


def _format_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return str(value)


# ─── Phase entry point ─────────────────────────────────────────────

async def run(ctx: PhaseContext) -> PhaseResult:
    locale = _resolve_locale(ctx.state.get("report_locale"))

    raw_findings = await LOAD_FINDINGS_FN(ctx.scan_id)

    # Partition. Per recon-safety rule 10 ("no exploit, no report"): only
    # rows with a non-empty proof_of_concept enter the confirmed list.
    confirmed: list[dict[str, Any]] = []
    discarded: list[dict[str, Any]] = []
    for f in raw_findings:
        status = f.get("status")
        if status == "confirmed" and f.get("proof_of_concept"):
            confirmed.append(f)
        else:
            discarded.append(f)

    confirmed = _sort_confirmed(confirmed)
    summary = _build_summary(confirmed)

    auth = await LOAD_AUTHORIZATION_FN(ctx.scan_id)
    meta = await LOAD_SCAN_META_FN(ctx.scan_id)

    template = _load_template(locale)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    markdown = _substitute(
        template,
        {
            "scan_id": ctx.scan_id,
            "project": str(meta.get("project_name") or "-"),
            "environment": str(meta.get("environment_name") or "-"),
            "generated_at": generated_at,
            "authorized_by": str(
                (auth or {}).get("acknowledged_by")
                or (auth or {}).get("acknowledged_by_user_id")
                or "-"
            ),
            "authorized_at": _format_datetime((auth or {}).get("acknowledged_at"))
            if auth
            else "-",
            "total_findings": str(summary["total"]),
            "critical_count": str(summary["by_severity"]["critical"]),
            "high_count": str(summary["by_severity"]["high"]),
            "medium_count": str(summary["by_severity"]["medium"]),
            "low_count": str(summary["by_severity"]["low"]),
            "top_risks": _render_top_risks(confirmed),
            "findings_section": _render_findings_section(confirmed),
            "discarded_table": _render_discarded_table(discarded),
            "authorization_block": _render_authorization_block(auth),
        },
    )

    markdown = await _scrub_markdown(markdown, confirmed)

    pdf_url: Optional[str] = None
    try:
        pdf_url = await RENDER_PDF_FN(markdown)
    except Exception as e:  # noqa: BLE001 — PDF is optional, never block the report.
        logger.warning("PDF render failed for scan %s: %s", ctx.scan_id, e)
        pdf_url = None

    report_id: Optional[str] = None
    try:
        report_id = await PERSIST_REPORT_FN(
            ctx.scan_id, markdown, summary, pdf_url
        )
    except Exception as e:  # noqa: BLE001 — surface the failure in state but keep state intact
        logger.error("persist recon_report failed for scan %s: %s", ctx.scan_id, e)

    ctx.state["report_markdown"] = markdown
    ctx.state["report_summary"] = summary
    ctx.state["report_id"] = report_id
    ctx.state["report_pdf_url"] = pdf_url
    ctx.state["report_findings"] = confirmed

    # Billing — one ``recon_scan_run`` event per completed pipeline.
    # The per-phase ``recon_phase_reporting`` event is intentionally
    # skipped because the aggregate scan event supersedes it.
    try:
        await EMIT_BILLING_FN(ctx.workspace_id, "recon_scan_run", 1)
    except Exception as e:  # noqa: BLE001 — billing emit must not fail the scan
        logger.warning("billing emit failed for scan %s: %s", ctx.scan_id, e)

    return PhaseResult(
        artifact_id=report_id,
        summary=f"report generated with {summary['total']} confirmed findings",
    )


__all__ = [
    "BANNED_VOCAB",
    "EMIT_BILLING_FN",
    "LLM_SCRUB_FN",
    "LOAD_AUTHORIZATION_FN",
    "LOAD_FINDINGS_FN",
    "LOAD_SCAN_META_FN",
    "PERSIST_REPORT_FN",
    "RENDER_PDF_FN",
    "SUPPORTED_LOCALES",
    "run",
]
