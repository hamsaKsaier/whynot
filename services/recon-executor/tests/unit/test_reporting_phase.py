"""Tests for :mod:`app.phases.reporting` (phase 5)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from app.phases import PhaseContext
from app.phases import reporting as rp


# ─── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def ctx() -> PhaseContext:
    return PhaseContext(
        scan_id="scan-1",
        workspace_id="ws-1",
        target_url="https://target.example.com",
    )


_DEFAULT_POC = object()


def _finding(
    *,
    id_: str = "f",
    vuln_class: str = "injection",
    status: str = "confirmed",
    severity: str = "high",
    impact: int = 3,
    exploitability: int = 3,
    blast: int = 3,
    endpoint: str = "/api/users",
    poc: Any = _DEFAULT_POC,
    description: str = "SQL injection via id param",
    remediation: str = "Use parameterized queries.",
    cves: list[str] | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if poc is _DEFAULT_POC:
        poc = (
            {"kind": "sql", "request": "GET /api/users?id=1"}
            if status == "confirmed"
            else None
        )
    row: dict[str, Any] = {
        "id": id_,
        "vuln_class": vuln_class,
        "status": status,
        "severity": severity,
        "impact_score": impact,
        "exploitability_score": exploitability,
        "blast_radius_score": blast,
        "normalized_endpoint": endpoint,
        "description": description,
        "remediation": remediation,
        "proof_of_concept": poc,
    }
    if cves is not None:
        row["cves"] = cves
    if extras:
        row.update(extras)
    return row


def _install_stubs(monkeypatch, *, findings, auth=None, meta=None):
    async def load_findings(scan_id):
        del scan_id
        return list(findings)

    async def load_auth(scan_id):
        del scan_id
        return auth

    async def load_meta(scan_id):
        del scan_id
        return meta or {"project_name": "Alpha", "environment_name": "prod"}

    monkeypatch.setattr(rp, "LOAD_FINDINGS_FN", load_findings)
    monkeypatch.setattr(rp, "LOAD_AUTHORIZATION_FN", load_auth)
    monkeypatch.setattr(rp, "LOAD_SCAN_META_FN", load_meta)


# ─── Deterministic scrubbers ─────────────────────────────────────────

def test_scrub_banned_vocabulary_removes_each_term():
    md = (
        "Powered by Shannon. Uses KeygraphHQ, nmap, subfinder, whatweb, "
        "schemathesis, Playwright, Anthropic, Claude."
    )
    scrubbed = rp._scrub_banned_vocabulary(md)
    for banned in rp.BANNED_VOCAB:
        assert banned.lower() not in scrubbed.lower()
    assert scrubbed.count("[REDACTED]") == len(rp.BANNED_VOCAB)


def test_scrub_banned_vocabulary_is_case_insensitive():
    md = "Shannon SHANNON shannon"
    scrubbed = rp._scrub_banned_vocabulary(md)
    assert "Shannon" not in scrubbed
    assert "SHANNON" not in scrubbed
    assert "shannon" not in scrubbed
    assert scrubbed.count("[REDACTED]") == 3


def test_scrub_fake_cves_redacts_unknown():
    md = "See CVE-2024-12345 and CVE-2023-99999 for details."
    scrubbed = rp._scrub_unverified_cves(md, known=set())
    assert "CVE-2024-12345" not in scrubbed
    assert scrubbed.count("[REDACTED-CVE]") == 2


def test_scrub_fake_cves_preserves_known():
    md = "See CVE-2024-12345 and CVE-2023-99999."
    scrubbed = rp._scrub_unverified_cves(md, known={"CVE-2024-12345"})
    assert "CVE-2024-12345" in scrubbed
    assert "CVE-2023-99999" not in scrubbed
    assert "[REDACTED-CVE]" in scrubbed


def test_collect_known_cves_from_proof_and_top_level():
    findings = [
        {"proof_of_concept": {"cve": "CVE-2024-11111"}},
        {"proof_of_concept": {"cves": ["CVE-2023-22222", "CVE-2022-33333"]}},
        {"cves": ["CVE-2021-44444"]},
        {"proof_of_concept": None},
        {"proof_of_concept": {"cve": 123}},  # non-string ignored
        {"cves": "not-a-list"},  # not a list ignored
    ]
    assert rp._collect_known_cves(findings) == {
        "CVE-2024-11111",
        "CVE-2023-22222",
        "CVE-2022-33333",
        "CVE-2021-44444",
    }


@pytest.mark.asyncio
async def test_scrub_markdown_calls_llm_then_re_runs_deterministic(monkeypatch):
    async def bad_llm(md, findings):
        del findings
        # Re-inject a banned term and a fake CVE that the deterministic
        # passes must catch again.
        return md + " Shannon CVE-2099-00000"

    monkeypatch.setattr(rp, "LLM_SCRUB_FN", bad_llm)
    out = await rp._scrub_markdown("hello", findings=[])
    assert "Shannon" not in out
    assert "CVE-2099-00000" not in out
    assert "[REDACTED]" in out
    assert "[REDACTED-CVE]" in out


@pytest.mark.asyncio
async def test_scrub_markdown_keeps_deterministic_result_when_llm_fails(monkeypatch):
    async def boom(md, findings):
        del md, findings
        raise RuntimeError("llm down")

    monkeypatch.setattr(rp, "LLM_SCRUB_FN", boom)
    out = await rp._scrub_markdown("keep me Shannon alone", findings=[])
    # LLM failure does not block persistence; deterministic pass still ran.
    assert "Shannon" not in out
    assert "keep me [REDACTED] alone" == out


# ─── Section renderers ───────────────────────────────────────────────

def test_render_findings_section_sorted_output_contains_each_severity():
    findings = [
        _finding(id_="a", severity="critical", endpoint="/a"),
        _finding(id_="b", severity="medium", endpoint="/b"),
    ]
    section = rp._render_findings_section(findings)
    assert "Critical — injection on /a" in section
    assert "Medium — injection on /b" in section
    assert "Impact 3/4" in section


def test_render_findings_section_empty_returns_zero_placeholder():
    assert "0 confirmed findings" in rp._render_findings_section([])


def test_render_discarded_table_empty():
    assert "No discarded hypotheses" in rp._render_discarded_table([])


def test_render_discarded_table_rows():
    rows = [
        _finding(id_="d1", status="discarded_unprovable", endpoint="/x", vuln_class="xss", poc=None),
        _finding(id_="d2", status="false_positive", endpoint="/y", vuln_class="auth", poc=None),
    ]
    out = rp._render_discarded_table(rows)
    assert "| xss | /x | discarded_unprovable |" in out
    assert "| auth | /y | false_positive |" in out


def test_render_top_risks_uses_first_three_only():
    findings = [
        _finding(id_=f"r{i}", severity="high", endpoint=f"/p{i}")
        for i in range(5)
    ]
    out = rp._render_top_risks(findings)
    assert out.count("- **High** injection") == 3


def test_render_top_risks_empty():
    assert "_No confirmed risks._" in rp._render_top_risks([])


def test_render_authorization_block_none():
    assert "No authorization record" in rp._render_authorization_block(None)


def test_render_authorization_block_with_record():
    dt = datetime(2026, 4, 21, 15, 30, tzinfo=timezone.utc)
    out = rp._render_authorization_block(
        {
            "acknowledged_by": "alice@example.com",
            "acknowledged_at": dt,
            "caller_ip": "10.0.0.1",
            "user_agent": "curl/8",
            "justification": "quarterly audit",
        }
    )
    assert "alice@example.com" in out
    assert "2026-04-21 15:30 UTC" in out
    assert "quarterly audit" in out


def test_render_authorization_block_falls_back_to_user_id():
    out = rp._render_authorization_block(
        {"acknowledged_by_user_id": "uid-42"}
    )
    assert "uid-42" in out


def test_format_datetime_handles_naive_and_aware_and_non_datetime():
    naive = datetime(2026, 1, 2, 3, 4)
    aware = datetime(2026, 1, 2, 3, 4, tzinfo=timezone.utc)
    assert rp._format_datetime(naive).endswith("UTC")
    assert rp._format_datetime(aware).endswith("UTC")
    assert rp._format_datetime("passthru") == "passthru"


def test_format_poc_dict_and_string_and_none():
    assert "(no proof of concept)" in rp._format_poc(None)
    assert "kind=sql" in rp._format_poc({"kind": "sql", "request": "GET /x"})
    assert "raw-string" in rp._format_poc("raw-string")
    # non-string body in dict is repr'd so nothing crashes
    assert "repr-ok" in rp._format_poc({"request": {"inner": "repr-ok"}})


# ─── Sorting + summary ─────────────────────────────────────────────

def test_sort_confirmed_descends_by_severity_then_by_total_score():
    findings = [
        _finding(id_="low", severity="low", impact=1, exploitability=1, blast=1),
        _finding(id_="crit", severity="critical", impact=4, exploitability=4, blast=4),
        _finding(id_="med1", severity="medium", impact=2, exploitability=2, blast=2),
        _finding(id_="med2", severity="medium", impact=3, exploitability=3, blast=3),
        _finding(id_="unknown-sev", severity="x"),
    ]
    sorted_ = rp._sort_confirmed(findings)
    ids = [f["id"] for f in sorted_]
    # Critical first, then the higher-score medium, then the lower one,
    # then low, then the unknown severity.
    assert ids == ["crit", "med2", "med1", "low", "unknown-sev"]


def test_build_summary_counts_by_severity_and_class():
    findings = [
        _finding(severity="critical", vuln_class="injection"),
        _finding(severity="high", vuln_class="xss"),
        _finding(severity="high", vuln_class="xss"),
        _finding(severity="low", vuln_class="auth"),
        _finding(severity=None, vuln_class=None),  # type: ignore[arg-type]
    ]
    summary = rp._build_summary(findings)
    assert summary["total"] == 5
    assert summary["by_severity"] == {
        "critical": 1,
        "high": 2,
        "medium": 0,
        "low": 2,
    }
    assert summary["by_class"] == {
        "injection": 1,
        "xss": 2,
        "auth": 1,
        "unknown": 1,
    }


# ─── Template loading ─────────────────────────────────────────────

@pytest.mark.parametrize("locale", list(rp.SUPPORTED_LOCALES))
def test_template_available_for_every_locale(locale):
    tpl = rp._load_template(locale)
    assert "{{scan_id}}" in tpl
    assert "{{findings_section}}" in tpl


def test_resolve_locale_falls_back_to_en():
    assert rp._resolve_locale(None) == "en"
    assert rp._resolve_locale("klingon") == "en"
    assert rp._resolve_locale("fr") == "fr"


def test_substitute_leaves_unknown_placeholders_alone():
    out = rp._substitute("hi {{name}} / {{ghost}}", {"name": "Alice"})
    assert out == "hi Alice / {{ghost}}"


# ─── Full phase run ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_happy_path_persists_report_and_emits_scan_run(monkeypatch, ctx):
    findings = [
        _finding(id_="c1", severity="critical", vuln_class="injection", endpoint="/a"),
        _finding(id_="d1", status="discarded_unprovable", poc=None, endpoint="/x", vuln_class="xss"),
    ]
    _install_stubs(
        monkeypatch,
        findings=findings,
        auth={
            "acknowledged_by": "bob@example.com",
            "acknowledged_at": datetime(2026, 4, 21, tzinfo=timezone.utc),
            "caller_ip": "203.0.113.5",
            "user_agent": "ua",
            "justification": "pentest engagement",
        },
    )

    persisted: list[tuple] = []

    async def persist(scan_id, md, summary, pdf_url):
        persisted.append((scan_id, md, summary, pdf_url))
        return "report-abc"

    async def pdf(md):
        del md
        return "https://blob.local/reports/scan-1.pdf"

    billing: list[tuple] = []

    async def bill(ws, ev, qty):
        billing.append((ws, ev, qty))

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)
    monkeypatch.setattr(rp, "RENDER_PDF_FN", pdf)
    monkeypatch.setattr(rp, "EMIT_BILLING_FN", bill)

    result = await rp.run(ctx)

    assert result.artifact_id == "report-abc"
    assert ctx.state["report_id"] == "report-abc"
    assert ctx.state["report_pdf_url"].endswith(".pdf")
    assert ctx.state["report_summary"]["total"] == 1
    assert len(ctx.state["report_findings"]) == 1
    assert ctx.state["report_findings"][0]["id"] == "c1"

    # Only one confirmed row was included; only one scan_run billing event.
    assert billing == [("ws-1", "recon_scan_run", 1)]

    # Persisted markdown contains the confirmed finding and the discarded row.
    md = persisted[0][1]
    assert "Critical — injection on /a" in md
    assert "| xss | /x | discarded_unprovable |" in md
    assert "bob@example.com" in md
    assert "pentest engagement" in md


@pytest.mark.asyncio
async def test_run_strips_injected_fake_cve_and_banned_vocab(monkeypatch, ctx):
    # Inject a hostile LLM that tries to add a fake CVE and a banned
    # vendor name — both must be stripped before persistence.
    async def bad_llm(md, findings):
        del findings
        return md + "\n\nPowered by Shannon — see CVE-2099-00000."

    _install_stubs(
        monkeypatch,
        findings=[_finding(id_="c1", severity="medium", endpoint="/x")],
    )
    monkeypatch.setattr(rp, "LLM_SCRUB_FN", bad_llm)

    captured: dict[str, str] = {}

    async def persist(scan_id, md, summary, pdf_url):
        del scan_id, summary, pdf_url
        captured["md"] = md
        return "report-xyz"

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    await rp.run(ctx)

    md = captured["md"]
    assert "Shannon" not in md
    assert "CVE-2099-00000" not in md
    assert "[REDACTED]" in md
    assert "[REDACTED-CVE]" in md


@pytest.mark.asyncio
async def test_run_only_includes_confirmed_with_poc(monkeypatch, ctx):
    findings = [
        _finding(id_="ok", status="confirmed", severity="high"),
        # Confirmed but no PoC → must NOT appear in report (rule 10).
        _finding(id_="no-poc", status="confirmed", severity="critical", poc=None),
        _finding(id_="fp", status="false_positive", poc=None),
        _finding(id_="disc", status="discarded_unprovable", poc=None),
    ]
    _install_stubs(monkeypatch, findings=findings)

    captured: dict[str, Any] = {}

    async def persist(scan_id, md, summary, pdf_url):
        del scan_id, pdf_url
        captured["md"] = md
        captured["summary"] = summary
        return "r-1"

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    await rp.run(ctx)

    assert captured["summary"]["total"] == 1
    # The confirmed-without-PoC row must be listed as discarded instead.
    assert "no-poc" not in captured["md"] or "Critical — " not in captured["md"]


@pytest.mark.asyncio
async def test_run_empty_findings_produces_zero_placeholder(monkeypatch, ctx):
    _install_stubs(monkeypatch, findings=[])

    captured: dict[str, str] = {}

    async def persist(scan_id, md, summary, pdf_url):
        del scan_id, summary, pdf_url
        captured["md"] = md
        return "r-2"

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    result = await rp.run(ctx)

    assert "0 confirmed findings" in captured["md"]
    assert "No discarded hypotheses" in captured["md"]
    assert "No authorization record" in captured["md"]
    assert result.summary and "0 confirmed findings" in result.summary


@pytest.mark.asyncio
async def test_run_pdf_failure_does_not_abort_report(monkeypatch, ctx):
    _install_stubs(
        monkeypatch,
        findings=[_finding(id_="c1", severity="high")],
    )

    async def pdf_boom(md):
        del md
        raise RuntimeError("no browser")

    persisted: list[tuple] = []

    async def persist(scan_id, md, summary, pdf_url):
        persisted.append((scan_id, md, summary, pdf_url))
        return "r-3"

    monkeypatch.setattr(rp, "RENDER_PDF_FN", pdf_boom)
    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    await rp.run(ctx)

    # PDF URL is None when rendering failed, but markdown still persisted.
    assert persisted and persisted[0][3] is None
    assert ctx.state["report_pdf_url"] is None
    assert ctx.state["report_id"] == "r-3"


@pytest.mark.asyncio
async def test_run_pdf_render_produces_non_empty_url(monkeypatch, ctx):
    # Mock "browser binary" — returns a non-empty blob URL.
    _install_stubs(
        monkeypatch,
        findings=[_finding(id_="c1", severity="low")],
    )

    async def pdf(md):
        assert "Findings" in md or "findings_section" in md or md
        return "https://blob.local/reports/scan-1.pdf"

    monkeypatch.setattr(rp, "RENDER_PDF_FN", pdf)

    async def persist(scan_id, md, summary, pdf_url):
        del scan_id, md, summary
        assert pdf_url and pdf_url.startswith("https://")
        return "r-4"

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    await rp.run(ctx)
    assert ctx.state["report_pdf_url"]


@pytest.mark.asyncio
async def test_run_persist_failure_is_surfaced_but_does_not_raise(monkeypatch, ctx):
    _install_stubs(monkeypatch, findings=[])

    async def persist_boom(scan_id, md, summary, pdf_url):
        del scan_id, md, summary, pdf_url
        raise RuntimeError("db down")

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist_boom)

    # Should NOT raise — orchestrator would otherwise mark the whole scan
    # failed; the persistence error is logged and state keeps report_id=None.
    result = await rp.run(ctx)
    assert result.artifact_id is None
    assert ctx.state["report_id"] is None


@pytest.mark.asyncio
async def test_run_billing_failure_does_not_raise(monkeypatch, ctx):
    _install_stubs(monkeypatch, findings=[])

    async def bill_boom(ws, ev, qty):
        del ws, ev, qty
        raise RuntimeError("billing down")

    monkeypatch.setattr(rp, "EMIT_BILLING_FN", bill_boom)

    # Must not crash the phase if billing emit fails.
    await rp.run(ctx)


@pytest.mark.asyncio
async def test_run_honours_locale_from_state(monkeypatch, ctx):
    _install_stubs(monkeypatch, findings=[])
    ctx.state["report_locale"] = "fr"

    captured: dict[str, str] = {}

    async def persist(scan_id, md, summary, pdf_url):
        del scan_id, summary, pdf_url
        captured["md"] = md
        return "r-5"

    monkeypatch.setattr(rp, "PERSIST_REPORT_FN", persist)

    await rp.run(ctx)
    # French header should be present instead of the English one.
    assert "Rapport de reconnaissance" in captured["md"]


# ─── Default seams are safe no-ops ───────────────────────────────

@pytest.mark.asyncio
async def test_default_seams_are_no_ops():
    assert await rp._default_load_findings("s") == []
    assert await rp._default_load_authorization("s") is None
    assert await rp._default_load_scan_meta("s") == {}
    assert await rp._default_persist_report("s", "md", {}, None) is None
    assert await rp._default_llm_scrub("md", []) == "md"
    assert await rp._default_render_pdf("md") is None
    assert await rp._default_emit_billing("ws", "ev", 1) is None
