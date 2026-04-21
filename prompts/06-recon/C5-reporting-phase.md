# Recon — Reporting phase (phase 5)

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/finding-severity/` (A5), `.claude/skills/pentest-orchestration/` (A3)
- Supporting: `.claude/skills/copywriting/` (for tone of the executive summary)
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A3, A5, A7, B1, C1, C4

## Task
Implement phase 5: consolidate confirmed findings into a single Markdown report (with an optional rendered PDF), redact noise, and finalize the scan.

### 1. File
- `services/recon-executor/app/phases/reporting.py`

### 2. Inputs
- All `recon_findings` rows for the scan with `status='confirmed'`.
- All phase artifacts (for the methodology section).
- The scan's authorization payload (for the legal-context preamble).

### 3. Report shape (Markdown)
```
# Recon report — <project> / <environment>
**Scan ID:** ...
**Generated:** <ISO date>
**Authorized by:** <user> on <date>

## Executive summary
- Total findings: N (Critical: x, High: y, Medium: z, Low: w)
- Top 3 risks (one-liner each)

## Methodology
Brief description of the 5 phases (using the renamed labels: Fingerprinting / Discovery / Vulnerability Analysis / Exploitation / Reporting). NEVER reference the upstream tool, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, or Claude.

## Findings
For each confirmed finding (sorted by severity descending):
### {Severity} — {vulnClass} on {endpoint}
**Severity score:** Impact {a}/4, Exploitability {b}/4, Blast radius {c}/4
**Description:** ...
**Proof of concept:** ```{code block from finding.proof_of_concept}```
**Reproducibility steps:** ...
**Recommended remediation:** ...

## Discarded hypotheses
A brief table of `false_positive` + `discarded_unprovable` items so the reader knows what was tried.

## Authorization & legal
A short block citing the authorization audit row.
```

### 4. Hallucination scrubber
Before persisting the Markdown, run an LLM pass that strips:
- References to vulnerabilities not in the findings list
- Fabricated CVE numbers (anything matching `CVE-\d{4}-\d{4,}` is verified against the actual finding's metadata)
- References to internal tooling names (regex match against the banned-vocabulary list from `.claude/rules/recon-safety.md` rule #6)

### 5. Storage
- Insert one row in `recon_reports` (per B1 — `scan_id` is unique).
- Optional PDF render: use a headless-browser PDF print of the rendered Markdown. Store at `recon_reports.pdf_url` (workspace-scoped blob storage).

### 6. Per-phase + scan billing
On phase completion AND scan completion, write the single `recon_scan_run` PAYG event (per B3) — not the per-phase `recon_phase_reporting` event, since the full pipeline finished.

### Tests
- Report contains exactly the confirmed findings, sorted descending by severity.
- Hallucination scrubber removes injected fake CVEs.
- Banned-vocabulary scrubber: a planted "powered by Shannon" line is removed.
- Empty findings → report still generated with an "0 confirmed findings" summary.
- PDF render produces a non-empty file (mock the browser binary).
- Final scan status = `completed`, `completed_at` set.
- 100% coverage on new files.

### i18n
- Report language follows the user's workspace locale (5 langs). Templates in `services/recon-executor/app/templates/report.{en,ar,fr,de,es}.md`.
- Backend (gateway): `success:recon.report.generated`, `errors:recon.report.generationFailed`
- Frontend labels for the report viewer: handled in D4.

### Documentation
- E3: "Reading reports" page in `/docs/recon/`.

### Files to modify
- `services/recon-executor/app/phases/reporting.py`
- `services/recon-executor/app/templates/report.{5 langs}.md`
- Tests
- Locale files
