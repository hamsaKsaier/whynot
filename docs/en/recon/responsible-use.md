---
title: "Recon — Authorization & responsible use"
description: "Per-scan authorization, the audit log, and your legal obligations when running Recon."
lang: en
draft: false
---

# Authorization & responsible use

Recon runs active probes against web targets. Unauthorized probing is illegal in almost every jurisdiction, and Recon is designed around a **per-scan authorization gate** so that you — the person launching the scan — explicitly take responsibility each time.

This page explains what that gate is, what the audit log captures, and what the underlying law looks like.

---

## The per-scan authorization gate

Every scan requires a signed authorization block before it is enqueued. The gateway will reject any scan request that does not include one.

Launching a scan records:

- The user who launched it.
- The workspace the scan ran under.
- The exact target URL (byte-equal to what was submitted).
- The scope level.
- Three explicit confirmations from the launcher:
  1. "I am authorized to scan this target."
  2. "I understand this scan will send active probes."
  3. The legal entity the launcher represents.
- An optional written-authorization reference (ticket ID, email thread, contract).
- The launcher's IP address and the timestamp.

This row is **immutable**. It cannot be edited or deleted, and it is retained for the lifetime of the workspace.

You can review every authorization ever recorded under **Settings → Recon → Audit log**.

## Why per-scan, not per-workspace

"Per-workspace" authorization — checking a box once at setup — is common and dangerously weak. It means a new team member, or an operator months later, could launch a scan against the wrong target with no fresh attestation.

Per-scan authorization forces a deliberate action every time. The friction is the feature.

## Resume requires URL match

If a scan is paused and resumed — manually, or automatically after a transient failure — Recon compares the resume target URL to the originally authorized URL **byte-for-byte**. Any difference (different host, different path, different scheme, even a trailing slash) causes the resume to be rejected.

This prevents two real attack patterns:

- **Redirect drift.** A target's DNS or HTTP redirect changes between pause and resume, silently pointing probes at a different host.
- **Typo drift.** An operator edits the URL during troubleshooting and accidentally widens scope.

If a resume is rejected for URL mismatch, launch a new scan with a new authorization block.

## Write-class exploits are never auto-retried

Recon classifies each candidate exploit as `read` (non-destructive — reads data, proves existence) or `write` (destructive — mutates state, creates, deletes, or modifies). A failed **read** exploit may be retried under rate and retry caps. A failed **write** exploit is recorded once and never retried within the scan, even if the executor crashes and resumes.

This is a deliberate safety property: a destructive payload that half-succeeded could leave the target in a partial or corrupt state. Retrying could compound the damage. If the finding needs re-verification, launch a fresh scan.

## What Recon does not do

- Recon does **not** perform denial-of-service testing. Stress-testing, volumetric attacks, and resource-exhaustion probes are out of scope and cannot be enabled.
- Recon does **not** scan targets you do not explicitly authorize. There is no "scan my whole org" button.
- Recon does **not** store raw exploit payloads in logs at INFO level or above. Payload-shaped strings are redacted before logging. See the internal platform documentation for the full redaction list.

## Your legal obligations — plain-language summary

> **This is a plain-language summary, not legal advice.** If you are unsure, consult a lawyer who specializes in your jurisdiction.

### United States — Computer Fraud and Abuse Act (CFAA)

The CFAA (18 U.S.C. § 1030) makes it a federal crime to access a computer "without authorization" or to "exceed authorized access." In the context of Recon, this means you must have explicit permission — from someone legally empowered to give it — to scan the target. A bug-bounty program's scope, a written pentest engagement letter, or a signed contract usually qualifies. Scanning a target because you "found it interesting" does not.

### European Union — NIS2 and national equivalents

Most EU member states have criminal statutes that mirror the CFAA (e.g. Germany's StGB § 202c, France's Godfrain law, Spain's Art. 197 Código Penal). The NIS2 directive (EU 2022/2555) layers additional obligations on essential and important entities. The short version is the same as the CFAA: no authorization, no scan.

### United Kingdom — Computer Misuse Act 1990

Sections 1–3 criminalize unauthorized access, unauthorized access with intent, and unauthorized modification. Penalties include imprisonment. The Act applies to scans launched from the UK and to scans targeting UK systems.

### Other jurisdictions

Most jurisdictions have equivalent laws. If you are scanning a target that straddles multiple jurisdictions (e.g. a US company's EU data center), assume the strictest applicable law governs your conduct.

## Bug-bounty programs

If you are running Recon against a bug-bounty target:

- Confirm your activity is within the program's published scope.
- Confirm active probing is allowed (some programs restrict to passive testing).
- Paste the program's authorization URL into the written-authorization reference field when you launch the scan.
- Save the authorization audit log entry — you may need to show it if a finding is disputed.

## Red flags — do not scan

Do **not** launch a scan if any of these apply:

- You are not certain who owns the target.
- Your authorization is oral and undocumented.
- You are scanning "to see what happens."
- The target is live production and the owner has not explicitly consented to active probing.
- You do not understand the scope options and their impact.

---

Related:

- [Quickstart](quickstart.md) — how to launch a scan.
- [Understanding findings](understanding-findings.md) — how to read severity and exploit outcomes.
- [Troubleshooting](troubleshooting.md) — authorization errors and what they mean.
