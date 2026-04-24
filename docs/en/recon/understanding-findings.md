---
title: "Recon — Understanding findings"
description: "Severity rubric, exploit-outcome semantics, and the false-positive policy for Recon findings."
lang: en
draft: false
---

# Understanding findings

A Recon scan produces zero or more **findings**. Each finding represents a confirmed or suspected security issue on the target, graded for severity and accompanied by a reproducible proof-of-concept.

This page explains how to read a finding: what the severity labels mean, what the exploit-outcome field tells you, and how Recon decides what to include in a report.

---

## Anatomy of a finding

Every finding has the following fields:

| Field | Meaning |
|-------|---------|
| **Title** | A short summary of the issue. |
| **Severity** | Critical, High, Medium, Low, or Info. See the rubric below. |
| **Vulnerability class** | The category — SQL injection, reflected XSS, SSRF, broken access control, etc. |
| **Target** | The endpoint or surface where the issue was found. |
| **Proof-of-concept** | A reproducible artifact (request, command, or script) that demonstrates the issue. |
| **Exploit outcome** | What the proof-of-concept actually achieved. See below. |
| **Recommended remediation** | A concrete fix, not a generic "use secure coding practices" line. |
| **Confidence** | High, Medium, or Low — how sure Recon is that this is a real issue. |
| **First seen / Last seen** | Timestamps across scans. Re-scanning updates these. |

## Severity rubric

Recon uses a five-level rubric. Severity is computed from three inputs: the technical impact, how easy the issue is to exploit, and how much sensitive data or privileged action it exposes.

### Critical

The issue allows a remote, unauthenticated attacker to achieve one of:

- Execute arbitrary code on the target.
- Read or modify arbitrary production data.
- Assume the identity of another user without their cooperation.
- Bypass a core security control (auth, billing, tenancy) with a single request.

Critical findings should be treated as incidents. Assume exploitation is imminent.

### High

The issue allows privilege escalation, unauthorized data access, or bypass of a security control, but requires at least one of:

- A valid low-privilege account.
- User interaction (e.g. clicking a crafted link).
- Multiple chained requests.

High findings should be fixed within days, not weeks.

### Medium

The issue exposes sensitive information, weakens a security control, or enables an attack that requires significant additional effort (e.g. a chained exploit, or a stolen session token). Medium findings should be fixed in the next release cycle.

### Low

The issue is a hardening gap or a weak defense-in-depth layer. Exploiting it in isolation yields little. Examples: missing security headers, verbose error messages, out-of-date server banners.

### Info

The issue is not a vulnerability but a piece of attack-surface context you should know: an exposed admin panel, a staging domain indexed by search engines, a subdomain that should not be public.

## Exploit outcomes

Every finding in a report is backed by a concrete exploit attempt. The **exploit outcome** field tells you what that attempt actually did:

| Outcome | Meaning |
|---------|---------|
| **Read-confirmed** | A non-destructive proof-of-concept succeeded: data was read, a marker was returned, or an error leaked information. Safe to replay. |
| **Write-confirmed** | A destructive payload succeeded: state was changed, a record was created, updated, or deleted. Recon executes write-class exploits exactly once per scan and never retries them (see [Responsible use](responsible-use.md)). |
| **Write-attempted, outcome unknown** | A destructive payload was sent but the response did not clearly indicate success or failure. Treat as suspected vulnerability and verify manually. |
| **Read-attempted, inconclusive** | A non-destructive probe ran but the evidence is ambiguous. Usually downgraded to Info or suppressed. |

## No exploit, no report

Recon follows a strict **"no exploit, no report"** policy. A finding appears in the report **only** if it has a non-null, exact-reproducible `proof_of_concept`. If a probe could not produce a working artifact, the finding is either suppressed or published as Info without a report entry.

This is deliberate. A report full of "suspected SQL injection" entries you cannot reproduce is worse than no report, because it wastes triage time and erodes trust. When Recon ships a finding, you can reproduce it.

## False-positive policy

A false positive is a finding that looked real to the automated pipeline but is not actually exploitable. Recon's pipeline has three guards against false positives:

1. **Active confirmation.** Every reported finding includes a proof-of-concept that was actually executed and observed to produce the claimed outcome.
2. **Confidence labeling.** Findings where confirmation succeeded but the context is ambiguous are labeled `medium` or `low` confidence and surfaced with a disclaimer.
3. **User dismissal.** You can dismiss any finding with a reason: `false_positive`, `accepted_risk`, `duplicate`, or `out_of_scope`. Dismissed findings don't count against severity rollups and are suppressed from the next scan's diff unless the underlying evidence changes.

If you find a false positive that the pipeline should have caught, use the **Report a false positive** link on the finding card. We use these reports to improve confidence scoring.

## Re-scans and diffs

When you re-scan the same target:

- Findings that are still present update their `last_seen` timestamp.
- Findings that were present before but are now gone are marked **fixed**.
- Findings that are new appear with a `new` badge.

This is how you verify that a remediation actually landed. A report where a previously Critical finding is now marked **fixed** is the single most useful output Recon can produce.

---

Related:

- [Reading reports](reading-reports.md) — report structure, sharing, and PDF export.
- [Sample report](sample-report.md) — a redacted example.
- [Responsible use](responsible-use.md) — why write-class exploits are never retried.
