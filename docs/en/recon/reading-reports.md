---
title: "Recon — Reading reports"
description: "Report structure, sharing, and PDF export for Recon scan results."
lang: en
draft: false
---

# Reading reports

A Recon report is the human-readable output of a scan. It is organized to be useful to three audiences in the same document: an engineer who has to fix the issue, a security reviewer who has to validate it, and an executive who needs to know the blast radius.

This page explains the report structure, how to share it, and how to export it as PDF.

---

## Where to find reports

Every scan produces a report, available immediately when the scan finishes.

- From the Recon landing page, click a scan's row to open its detail page.
- In the scan-detail page, the **Report** tab renders the full report inline.
- Each scan also has a stable URL — you can share it (subject to the permissions below).

## Report structure

A report has six sections, always in this order:

### 1. Summary

One paragraph written for an executive reader. States the target, the scope, the total findings count by severity, and the single most important takeaway ("One Critical finding was confirmed," or "No exploitable findings.").

### 2. Risk overview

A table of finding counts by severity, with a comparison to the previous scan of the same target if one exists.

| Severity | This scan | Previous scan | Change |
|----------|-----------|---------------|--------|
| Critical | 1 | 0 | +1 |
| High | 3 | 5 | -2 |
| Medium | 7 | 6 | +1 |
| Low | 12 | 14 | -2 |
| Info | 22 | 19 | +3 |

The change column is the single best indicator of whether remediation is working.

### 3. Findings

Each finding is rendered as a full card containing:

- Title and severity badge.
- Target (endpoint, parameter, or surface).
- Vulnerability class.
- **What happened** — a plain-language description of the issue.
- **Proof-of-concept** — the reproducible artifact, syntax-highlighted.
- **Exploit outcome** — read-confirmed, write-confirmed, etc. See [Understanding findings](understanding-findings.md).
- **Why it matters** — the real-world impact.
- **Recommended remediation** — a specific, actionable fix.
- **References** — links to CWE, OWASP, and vendor advisories where applicable.

Findings are sorted by severity descending, then by confidence descending.

### 4. Scope and methodology

Lists what was scanned (URLs, endpoints discovered, parameters tested), what was explicitly out of scope, the authorization reference, and the scan scope level (surface, standard, deep).

### 5. Coverage gaps

Honest disclosure of what the scan did not reach: endpoints that required authentication Recon did not have, endpoints blocked by WAF rules, areas where the crawl budget was exhausted. A scan that doesn't disclose its gaps is overselling itself.

### 6. Audit trail

The authorization record (who, when, what target, what reference), the scan start and end timestamps, and a one-line provenance entry for every phase.

## Sharing a report

There are three ways to share a report:

### Workspace members

Anyone in the workspace with the `recon.scan.view` permission can open the report directly. No extra action needed.

### Shareable link (external)

Generate a time-limited, read-only link for a reviewer who is not a workspace member.

1. Open the scan-detail page.
2. Click **Share** in the header.
3. Pick an expiration (24 hours, 7 days, or 30 days) and, optionally, a passphrase.
4. Copy the link and send it.

External viewers see a sanitized view: the report content, but not workspace navigation, billing data, or other scans. They cannot trigger a re-scan or modify anything.

### PDF export

Click **Export PDF** in the report header. Recon renders the report to PDF using the same template as the web view. The PDF:

- Includes every section above.
- Embeds proofs-of-concept as formatted code blocks.
- Is paginated with a repeating header (scan name, target, date).
- Is suitable for attaching to an audit ticket or emailing to an executive.

PDF export is generated on demand and is not cached — a re-export after a re-scan picks up the latest data.

## Permissions summary

| Action | Required permission |
|--------|---------------------|
| View a report in the workspace | `recon.scan.view` |
| Create a shareable link | `recon.scan.share` |
| Export as PDF | `recon.scan.view` |
| Revoke a shareable link | `recon.scan.share` or workspace owner |
| Delete a scan and its report | Workspace owner |

## Retention

Reports are retained for the full data-retention window of your plan (see [Quotas](quotas.md) — Free: 7 days, Pro BYO: 30 days, Pro Managed: 90 days). After retention expires, the report is deleted; the authorization audit log row is kept for the lifetime of the workspace.

## When to re-scan

Re-scan when:

- You believe you have fixed at least one finding. The diff in section 2 is the verification.
- The target has changed substantially (new endpoints, new auth model).
- More than 30 days have passed since the last scan of a critical target.

Do not re-scan purely to churn the report. Each scan costs credits (see [Quotas](quotas.md)) and each scan records a new authorization entry.

---

Related:

- [Understanding findings](understanding-findings.md) — severity rubric and exploit outcomes.
- [Sample report](sample-report.md) — a redacted example.
- [Quotas and billing](quotas.md) — how much a re-scan costs.
