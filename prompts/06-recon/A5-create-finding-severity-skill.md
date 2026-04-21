# Recon — Create the `finding-severity` skill

## Agent
`recon-engineer` (A1).

## Skills
- Primary: `.claude/skills/spec-driven-development/`

## Dependencies
- A1

## Task
Create a skill that defines how Recon scores, deduplicates, and decides whether to ship a finding. This is the source of truth for C4 (exploitation) and C5 (reporting).

### 1. Files to create
- `.claude/skills/finding-severity/SKILL.md`
- `.claude/skills/finding-severity/references/cvss-lite-rubric.md`
- `.claude/skills/finding-severity/references/dedup-policy.md`
- `.claude/skills/finding-severity/references/no-exploit-no-report.md`

### 2. SKILL.md — required content

**CVSS-lite scoring.** A finding is scored on three integer axes (1–4 each):
- `impact` — what an attacker gains (1=info disclosure, 2=user data, 3=admin access, 4=RCE)
- `exploitability` — how reproducible the PoC is (1=manual + privileges, 4=anonymous + one HTTP request)
- `blast_radius` — how many users / records affected (1=single account, 4=full tenant)

Severity = bucketed sum: 3–5 = `low`, 6–8 = `medium`, 9–11 = `high`, 12 = `critical`.

**Deduplication.** Findings are deduped by `(scan_id, vuln_class, normalized_endpoint, normalized_param)`. The "normalized_endpoint" strips numeric IDs (`/users/123` → `/users/{id}`); "normalized_param" lowercases and removes index suffixes. The deduper keeps the highest-severity instance and merges the others into a `duplicates` JSONB array on the surviving row.

**No exploit, no report.** A finding is included in the report only if:
- `proof_of_concept` is non-null (a reproducible request, command, or browser script).
- `exploit_outcome` is one of `confirmed_data_access`, `confirmed_privilege_escalation`, `confirmed_command_execution`, `confirmed_redirect`, `confirmed_xss_execution` — never `theoretical` or `partial`.

Findings that fail this gate are stored with `status = 'discarded_unprovable'` (not `null`) so they appear in audit views but not in the user-facing report.

**False-positive handling.** If the executor's exploit fails 3 different ways for the same hypothesis, the finding is auto-marked `false_positive` and excluded from the report. The decision is logged so the next pipeline run can short-circuit.

### 3. References
- `cvss-lite-rubric.md` — full table mapping axis values to user-facing descriptions in en/ar/fr/de/es key prefixes (`recon.severity.axes.*`).
- `dedup-policy.md` — SQL UPSERT pattern for the dedup logic, with examples.
- `no-exploit-no-report.md` — the discriminated union of `exploit_outcome` values + an example of each.

### Tests
- The skill must instruct callers to write tests for: every (impact, exploitability, blast_radius) → severity bucket; dedup keeps highest severity; dedup merges duplicates; `theoretical` outcomes are discarded; 3-failure auto-`false_positive` rule.
- Edge cases: empty PoC string → discarded; non-ASCII in `normalized_param`; `vuln_class` not in the canonical 5-list → reject at insert time.

### i18n
- The skill lists the i18n keys it requires (all 5 locales):
  - `recon.severity.low`, `recon.severity.medium`, `recon.severity.high`, `recon.severity.critical`
  - `recon.severity.axes.impact.{1..4}`, `recon.severity.axes.exploitability.{1..4}`, `recon.severity.axes.blast_radius.{1..4}`
  - `recon.findings.status.confirmed`, `recon.findings.status.discarded`, `recon.findings.status.falsePositive`

### Documentation
- The skill must instruct E3 to publish a "Understanding findings" page in `/docs/recon/` (5 locales) that translates the scoring rubric into customer-friendly language.

### Files to modify
- Create the four files listed above under `.claude/skills/finding-severity/`.
