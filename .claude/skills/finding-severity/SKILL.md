> **Single source of truth**: Before proposing any change, read [`../../../ARCHITECTURE.md`](../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

---
name: finding-severity
description: "How Recon scores, deduplicates, and decides whether to ship a finding. Activate when building C4 (exploitation) severity scoring, finding deduplication, report inclusion gates, or false-positive handling. Keywords: recon, finding, severity, CVSS-lite, dedup, exploit_outcome, proof_of_concept, false_positive, blast_radius, impact, exploitability, no-exploit-no-report."
metadata:
  version: "1.0.0"
  author: "whynot Team"
  category: "recon-engineering"
  dependencies: "Python 3.11+, asyncpg"
  project: "whynot Recon Engine"
---

# Finding Severity Skill

You are an expert in vulnerability scoring, deduplication, and report-quality gating. Your goal is to implement Recon's finding-severity system inside `services/recon-executor/` so that only proven, non-duplicate findings reach the user-facing report.

## When to Use This Skill

- Implementing severity scoring for findings produced by Phase 4 (exploitation)
- Building deduplication logic that merges duplicate findings
- Writing the "no exploit, no report" gate that filters findings for Phase 5 (reporting)
- Implementing false-positive auto-marking after repeated exploit failures
- Writing tests for severity bucketing, dedup, or report-inclusion logic
- Adding i18n keys for finding severity labels

## Architecture Overview

This skill is the source of truth for two pipeline phases:

| Phase | Role |
|-------|------|
| **C4 — exploitation** | Scores each proven finding with the CVSS-lite rubric; auto-marks false positives |
| **C5 — reporting** | Deduplicates findings, applies the "no exploit, no report" gate, produces the final report |

### Canonical Vuln Classes

Findings are categorized into exactly **5 vuln classes**. Any finding with a `vuln_class` not in this list must be **rejected at insert time**:

```
injection, xss, ssrf, auth, authz
```

## CVSS-lite Scoring

A finding is scored on **three integer axes**, each ranging from 1 to 4:

### Axis: `impact`

What an attacker gains if the vulnerability is exploited.

| Value | Label | Description |
|-------|-------|-------------|
| 1 | Information disclosure | Exposure of non-sensitive metadata (version strings, error messages, headers) |
| 2 | User data access | Access to another user's PII, session tokens, or private resources |
| 3 | Admin access | Privilege escalation to admin-level operations or cross-tenant data |
| 4 | Remote code execution | Arbitrary command execution on the server or full system compromise |

### Axis: `exploitability`

How reproducible and accessible the proof-of-concept is.

| Value | Label | Description |
|-------|-------|-------------|
| 1 | Manual + privileges | Requires authenticated session, custom tooling, or chained exploits |
| 2 | Manual + no privileges | Reproducible by an unauthenticated attacker using standard tools |
| 3 | Scripted + privileges | Automated script but requires prior authentication or session |
| 4 | Anonymous + one HTTP request | Single unauthenticated HTTP request triggers the vulnerability |

### Axis: `blast_radius`

How many users or records are affected.

| Value | Label | Description |
|-------|-------|-------------|
| 1 | Single account | Only the attacker's own account or a single specific record |
| 2 | Small group | Up to 100 users or records within the same workspace |
| 3 | Large group | Hundreds to thousands of users across multiple workspaces |
| 4 | Full tenant | All users and data within the entire tenant / deployment |

### Severity Bucketing

Severity is computed as the sum of the three axes, then bucketed:

```
severity = impact + exploitability + blast_radius
```

| Sum | Severity |
|-----|----------|
| 3–5 | `low` |
| 6–8 | `medium` |
| 9–11 | `high` |
| 12 | `critical` |

### Python Implementation

```python
from enum import Enum


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


def compute_severity(impact: int, exploitability: int, blast_radius: int) -> Severity:
    for val in (impact, exploitability, blast_radius):
        if not 1 <= val <= 4:
            raise ValueError(f"Axis value must be 1-4, got {val}")

    total = impact + exploitability + blast_radius

    if total <= 5:
        return Severity.LOW
    elif total <= 8:
        return Severity.MEDIUM
    elif total <= 11:
        return Severity.HIGH
    else:
        return Severity.CRITICAL
```

See [`references/cvss-lite-rubric.md`](references/cvss-lite-rubric.md) for the full i18n-ready rubric table with user-facing descriptions in all 5 locales.

## Deduplication

### Dedup Key

Findings are deduplicated by the composite key:

```
(scan_id, vuln_class, normalized_endpoint, normalized_param)
```

### Normalization Rules

| Component | Rule | Example |
|-----------|------|---------|
| `normalized_endpoint` | Replace all numeric path segments with `{id}` | `/users/123/settings` → `/users/{id}/settings` |
| `normalized_param` | Lowercase; strip index suffixes (`[0]`, `[1]`, `_0`, `_1`) | `Filters[0]` → `filters`; `sort_order` → `sort_order` |

### Dedup Behavior

1. When two findings share the same dedup key, the **highest-severity instance** survives.
2. Lower-severity duplicates are merged into a `duplicates` JSONB array on the surviving row.
3. Each entry in the `duplicates` array preserves the original finding's `id`, `severity`, and `created_at`.

### SQL UPSERT Pattern

```sql
INSERT INTO recon_findings (
    scan_id, vuln_class, normalized_endpoint, normalized_param,
    impact, exploitability, blast_radius, severity,
    proof_of_concept, exploit_outcome, status,
    duplicates, created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, now())
ON CONFLICT (scan_id, vuln_class, normalized_endpoint, normalized_param)
DO UPDATE SET
    impact          = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $5 ELSE recon_findings.impact END,
    exploitability  = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $6 ELSE recon_findings.exploitability END,
    blast_radius    = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $7 ELSE recon_findings.blast_radius END,
    severity        = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $8 ELSE recon_findings.severity END,
    proof_of_concept = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $9 ELSE recon_findings.proof_of_concept END,
    exploit_outcome = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN $10 ELSE recon_findings.exploit_outcome END,
    duplicates      = CASE
                        WHEN $5 + $6 + $7 > (recon_findings.impact + recon_findings.exploitability + recon_findings.blast_radius)
                        THEN jsonb_insert(
                            jsonb_insert(recon_findings.duplicates, '{0}', jsonb_build_object(
                                'id', recon_findings.id,
                                'severity', recon_findings.severity,
                                'created_at', recon_findings.created_at
                            )) || recon_findings.duplicates
                        )
                        ELSE jsonb_insert(recon_findings.duplicates, '{-1}', jsonb_build_object(
                            'id', $12,
                            'severity', $8,
                            'created_at', now()
                        ))
                      END,
    updated_at      = now();
```

See [`references/dedup-policy.md`](references/dedup-policy.md) for the simplified Python helper and worked examples.

## No Exploit, No Report

A finding is included in the user-facing report **only if** both conditions are met:

### Condition 1: Proof of Concept

`proof_of_concept` must be **non-null and non-empty**. Accepted forms:

| Form | Example |
|------|---------|
| HTTP request | `curl -H "X-Admin: true" https://target/api/admin/users` |
| Command | `python3 exploit.py --target https://target --payload "'; SELECT * FROM users; --'"` |
| Browser script | `javascript:document.cookie` or a DOM XSS payload with observed effect |

An empty string `""` or whitespace-only string is treated as null — the finding is discarded.

### Condition 2: Confirmed Exploit Outcome

`exploit_outcome` must be one of:

| Value | Meaning |
|-------|---------|
| `confirmed_data_access` | Attacker accessed data they should not see |
| `confirmed_privilege_escalation` | Attacker gained elevated permissions |
| `confirmed_command_execution` | Attacker executed arbitrary commands |
| `confirmed_redirect` | Attacker triggered an open redirect to a controlled domain |
| `confirmed_xss_execution` | Attacker injected and executed arbitrary JavaScript |

The following outcomes are **never** included in the report:

| Value | Why excluded |
|-------|-------------|
| `theoretical` | No actual exploitation demonstrated |
| `partial` | Exploit was inconclusive; could not fully reproduce |

### Discarded Status

Findings that fail either condition are stored with `status = 'discarded_unprovable'` (not `null`). This ensures they appear in audit views but not in the user-facing report.

See [`references/no-exploit-no-report.md`](references/no-exploit-no-report.md) for the discriminated union definition and examples of each outcome.

## False-Positive Handling

### Auto-Mark Rule

If the executor's exploit fails **3 different ways** for the same hypothesis (same `vuln_class` + `normalized_endpoint` + `normalized_param` within a scan), the finding is auto-marked:

```
status = 'false_positive'
```

### Logging

The false-positive decision is logged to a `recon_false_positive_log` table:

```sql
CREATE TABLE recon_false_positive_log (
    id              BIGSERIAL PRIMARY KEY,
    scan_id         UUID NOT NULL REFERENCES recon_scans(id),
    vuln_class      recon_vuln_class NOT NULL,
    normalized_endpoint TEXT NOT NULL,
    normalized_param    TEXT NOT NULL,
    attempt_count   INT NOT NULL DEFAULT 1,
    failure_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    marked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scan_id, vuln_class, normalized_endpoint, normalized_param)
);
```

Each failure entry records:
- The tool call that was attempted
- The response or error received
- The timestamp of the attempt

### Short-Circuit

On subsequent pipeline runs, the executor checks `recon_false_positive_log` before attempting exploitation. If a `(vuln_class, normalized_endpoint, normalized_param)` triple has `attempt_count >= 3`, the executor **skips** that hypothesis and logs a short-circuit event.

## Vuln Class Validation

The canonical vuln class list is:

```python
CANONICAL_VULN_CLASSES = frozenset({"injection", "xss", "ssrf", "auth", "authz"})
```

Any finding inserted with a `vuln_class` not in this set must be **rejected at insert time** with a `ValueError`. This is enforced at the application layer (not just a DB constraint) so that test failures surface immediately.

## Implementation Location

```
services/recon-executor/
├── src/
│   ├── severity.py              # CVSS-lite scoring: compute_severity(), Severity enum
│   ├── dedup.py                 # normalize_endpoint(), normalize_param(), dedup UPSERT
│   ├── report_gate.py           # is_reportable(), apply_no_exploit_gate()
│   ├── false_positive.py        # check_false_positive_history(), log_false_positive()
│   ├── vuln_class.py            # CANONICAL_VULN_CLASSES, validate_vuln_class()
│   └── models.py                # Finding dataclass, ExploitOutcome enum
├── tests/
│   ├── test_severity.py         # Every (impact, exploitability, blast_radius) → bucket
│   ├── test_dedup.py            # Dedup keeps highest severity; merges duplicates
│   ├── test_report_gate.py      # theoretical outcomes discarded; empty PoC discarded
│   ├── test_false_positive.py   # 3-failure auto-false_positive rule
│   └── test_vuln_class.py       # Reject non-canonical vuln classes at insert
```

## Testing Requirements

Every behavior in this skill **must** have tests:

### Severity Scoring

| Test | Description |
|------|-------------|
| `test_severity_low_min` | `(1, 1, 1)` → `low` (sum = 3) |
| `test_severity_low_max` | `(1, 2, 2)` → `low` (sum = 5) |
| `test_severity_medium_min` | `(2, 2, 2)` → `medium` (sum = 6) |
| `test_severity_medium_max` | `(2, 3, 3)` → `medium` (sum = 8) |
| `test_severity_high_min` | `(3, 3, 3)` → `high` (sum = 9) |
| `test_severity_high_max` | `(3, 4, 4)` → `high` (sum = 11) |
| `test_severity_critical` | `(4, 4, 4)` → `critical` (sum = 12) |
| `test_severity_rejects_zero` | `(0, 1, 1)` raises `ValueError` |
| `test_severity_rejects_five` | `(5, 1, 1)` raises `ValueError` |

### Deduplication

| Test | Description |
|------|-------------|
| `test_dedup_keeps_highest_severity` | Two findings same key → higher severity survives |
| `test_dedup_merges_lower_into_duplicates` | Lower-severity finding appears in `duplicates` JSONB |
| `test_normalize_endpoint_strips_numeric_ids` | `/users/123/settings` → `/users/{id}/settings` |
| `test_normalize_endpoint_multi_ids` | `/orgs/5/projects/42` → `/orgs/{id}/projects/{id}` |
| `test_normalize_param_lowercases` | `Filters[0]` → `filters` |
| `test_normalize_param_strips_index` | `items_0` → `items` |
| `test_normalize_param_non_ascii` | Unicode in param is preserved but lowercased |

### No Exploit, No Report

| Test | Description |
|------|-------------|
| `test_theoretical_discarded` | `exploit_outcome='theoretical'` → `status='discarded_unprovable'` |
| `test_partial_discarded` | `exploit_outcome='partial'` → `status='discarded_unprovable'` |
| `test_empty_poc_discarded` | `proof_of_concept=''` → `status='discarded_unprovable'` |
| `test_whitespace_poc_discarded` | `proof_of_concept='   '` → `status='discarded_unprovable'` |
| `test_confirmed_data_access_reportable` | `exploit_outcome='confirmed_data_access'` with valid PoC → included |
| `test_confirmed_xss_reportable` | `exploit_outcome='confirmed_xss_execution'` with valid PoC → included |
| `test_null_poc_discarded` | `proof_of_concept=None` → `status='discarded_unprovable'` |

### False-Positive Handling

| Test | Description |
|------|-------------|
| `test_false_positive_after_three_failures` | 3 different failure reasons → `status='false_positive'` |
| `test_false_positive_not_before_three` | 2 failures → not marked false positive |
| `test_false_positive_short_circuit` | Existing log with `attempt_count >= 3` → skip exploitation |
| `test_false_positive_logs_reasons` | Each failure reason is recorded in `failure_reasons` JSONB |

### Vuln Class Validation

| Test | Description |
|------|-------------|
| `test_valid_vuln_classes` | All 5 canonical classes accepted |
| `test_invalid_vuln_class_rejected` | `'rce'` raises `ValueError` at insert |
| `test_empty_vuln_class_rejected` | `''` raises `ValueError` |
| `test_case_sensitive_vuln_class` | `'XSS'` raises `ValueError` (must be lowercase) |

### Edge Cases

| Test | Description |
|------|-------------|
| `test_non_ascii_normalized_param` | Arabic/Chinese characters in param are preserved |
| `test_dedup_same_severity_tiebreak` | Same severity → first-inserted survives |
| `test_multiple_axes_boundary` | `(2, 2, 3)` → `medium` (sum = 7), not `high` |

## i18n Keys

All keys must be added to **all 5 locales** (`en`, `ar`, `de`, `es`, `fr`) in both:
- `frontend/public/locales/{locale}/recon.json`
- `admin-frontend/public/locales/{locale}/recon.json`

### Required Keys

#### Severity Levels

| Key | English Default |
|-----|-----------------|
| `recon.severity.low` | Low |
| `recon.severity.medium` | Medium |
| `recon.severity.high` | High |
| `recon.severity.critical` | Critical |

#### Impact Axis

| Key | English Default |
|-----|-----------------|
| `recon.severity.axes.impact.1` | Information disclosure — non-sensitive metadata exposed |
| `recon.severity.axes.impact.2` | User data access — PII or session tokens exposed |
| `recon.severity.axes.impact.3` | Admin access — privilege escalation to admin level |
| `recon.severity.axes.impact.4` | Remote code execution — arbitrary command execution |

#### Exploitability Axis

| Key | English Default |
|-----|-----------------|
| `recon.severity.axes.exploitability.1` | Requires manual effort and prior privileges |
| `recon.severity.axes.exploitability.2` | Reproducible manually without prior privileges |
| `recon.severity.axes.exploitability.3` | Automated with a script, requires authentication |
| `recon.severity.axes.exploitability.4` | Single unauthenticated HTTP request triggers the issue |

#### Blast Radius Axis

| Key | English Default |
|-----|-----------------|
| `recon.severity.axes.blast_radius.1` | Single account — only affects the attacker's own data |
| `recon.severity.axes.blast_radius.2` | Small group — up to 100 users in the same workspace |
| `recon.severity.axes.blast_radius.3` | Large group — hundreds to thousands of users |
| `recon.severity.axes.blast_radius.4` | Full tenant — all users and data affected |

#### Finding Statuses

| Key | English Default |
|-----|-----------------|
| `recon.findings.status.confirmed` | Confirmed |
| `recon.findings.status.discarded` | Discarded — unprovable |
| `recon.findings.status.falsePositive` | False positive |

## Documentation

This skill instructs the documentation agent (E3) to publish a **"Understanding findings"** page.

### Location

```
docs/recon/understanding-findings.md
docs/ar/recon/understanding-findings.md
docs/de/recon/understanding-findings.md
docs/es/recon/understanding-findings.md
docs/fr/recon/understanding-findings.md
```

### Content Requirements

The page must translate the CVSS-lite scoring rubric into **customer-friendly language**:

1. **How severity is calculated** — explain the three axes in plain language, no jargon
2. **What each severity level means** — concrete examples of what `low`/`medium`/`high`/`critical` mean for the user's security posture
3. **Why some findings are discarded** — explain that findings without a proven exploit are not included, because unvalidated hypotheses create noise
4. **How duplicates are handled** — explain that the same vulnerability found on multiple endpoints is reported once, with references to each instance
5. **False positives** — explain that if an exploit cannot be reproduced after multiple attempts, it is automatically marked as a false positive

### E3 Instructions

When building the documentation for this skill:

1. Use the i18n keys listed above for all severity labels
2. Write for a **non-technical audience** (security-conscious developers, not pentesters)
3. Include a worked example: a SQL injection on `/api/users/{id}` with `(impact=2, exploitability=4, blast_radius=3)` → severity `high`
4. Translate the worked example into all 5 locales
5. Link to the CVSS-lite rubric reference for users who want the full detail

## Related Skills

- **pentest-orchestration**: The pipeline that produces findings during Phases 3–4
- **spec-driven-development**: For the full Spec Kit workflow when modifying severity logic
- **whynot-dashboard**: For building the UI components that display finding severity

## References

- [`references/cvss-lite-rubric.md`](references/cvss-lite-rubric.md) — Full rubric table with i18n key prefixes for all 5 locales
- [`references/dedup-policy.md`](references/dedup-policy.md) — SQL UPSERT pattern, Python helper, worked examples
- [`references/no-exploit-no-report.md`](references/no-exploit-no-report.md) — Discriminated union of `exploit_outcome` values with examples
