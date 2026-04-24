---
title: "Recon — Sample report"
description: "A redacted example of a Recon scan report."
lang: en
draft: false
---

# Sample report

This is a redacted example of a real Recon scan report. URLs, parameters, and responses have been altered to protect the original target. The structure, severity rubric, and proof-of-concept format are exactly what you will see for your own scans.

For an explanation of each section, see [Reading reports](reading-reports.md).

---

## Scan: example-staging.acme.dev

| Field | Value |
|-------|-------|
| **Target** | `https://example-staging.acme.dev` |
| **Environment** | `staging` |
| **Scope** | Standard |
| **Started** | 2026-04-22 14:02 UTC |
| **Finished** | 2026-04-22 14:31 UTC |
| **Launched by** | engineer@acme.dev |
| **Authorization reference** | INT-4421 (internal pentest ticket) |

---

## 1. Summary

A standard scan of `example-staging.acme.dev` completed in 29 minutes and produced **one Critical**, **two High**, and **four Medium** confirmed findings, plus eleven low/info entries.

The Critical finding is a SQL injection in the `/api/v1/orders` endpoint that allows an unauthenticated attacker to read arbitrary rows from the `orders` and `customers` tables. **Treat this as an incident.**

The two High findings are a broken-access-control issue on `/admin/users` and a stored XSS in the order-notes field; both require a low-privilege account to exploit.

Compared to the previous scan (2026-03-15), the Critical SQLi is **new**. Three previously-High findings are now marked **fixed**.

---

## 2. Risk overview

| Severity | This scan | Previous scan | Change |
|----------|-----------|---------------|--------|
| Critical | 1 | 0 | +1 |
| High | 2 | 5 | -3 |
| Medium | 4 | 4 | 0 |
| Low | 7 | 9 | -2 |
| Info | 4 | 3 | +1 |

---

## 3. Findings (excerpt)

### Finding 1 — SQL injection in `/api/v1/orders`

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Class** | SQL injection (CWE-89) |
| **Target** | `GET /api/v1/orders?status=<param>` |
| **Confidence** | High |
| **Exploit outcome** | Read-confirmed |

**What happened.** The `status` query parameter on `/api/v1/orders` is concatenated into a SQL `WHERE` clause without parameterization. An attacker can break out of the string context and inject arbitrary SQL. No authentication is required.

**Proof-of-concept.**

```http
GET /api/v1/orders?status=open'%20UNION%20SELECT%20[REDACTED]%20--%20 HTTP/1.1
Host: example-staging.acme.dev

HTTP/1.1 200 OK
Content-Type: application/json

{"orders":[{"id":1,"status":"[REDACTED-RESPONSE]"}]}
```

The injected `UNION` clause returned data from a different table, confirming injection. The actual payload and response have been redacted in this sample.

**Why it matters.** An unauthenticated attacker can read every row in any table the database user has access to, including the `customers` and `orders` tables. This is the highest-impact vulnerability class against a typical web application database.

**Recommended remediation.** Replace string concatenation with parameterized queries throughout the `/api/v1/orders` handler. The same code path likely exists in adjacent endpoints — audit the file. See OWASP A03:2021 — Injection for general guidance.

**References.**

- CWE-89: Improper Neutralization of Special Elements used in an SQL Command.
- OWASP Top 10 2021: A03 — Injection.

---

### Finding 2 — Broken access control on `/admin/users`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Class** | Broken access control (CWE-285) |
| **Target** | `GET /admin/users/{id}` |
| **Confidence** | High |
| **Exploit outcome** | Read-confirmed |

**What happened.** The `/admin/users/{id}` endpoint checks that the requester is logged in but does not check that they have the `admin` role. Any authenticated user can read any other user's profile, including email and role.

**Proof-of-concept.** A standard authenticated request from a non-admin account returned the full profile of a different user. Request and response redacted.

**Recommended remediation.** Add a role check to the route handler. Audit all `/admin/*` endpoints for the same gap.

---

### Finding 3 — Stored XSS in order notes

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Class** | Stored XSS (CWE-79) |
| **Target** | `POST /api/v1/orders/{id}/notes` |
| **Confidence** | High |
| **Exploit outcome** | Read-confirmed |

**What happened.** The `notes` field on an order is stored without sanitization and rendered as HTML on the order-detail page. A low-privilege user can inject script that executes when an admin views the order.

**Proof-of-concept.** A `<script>` payload (redacted) was stored and observed to execute in a separate session.

**Recommended remediation.** Render `notes` as text, not HTML. If rich text is required, use a vetted sanitizer with a strict allow-list.

---

*(Six additional findings omitted in this sample.)*

---

## 4. Scope and methodology

- **In scope.** `https://example-staging.acme.dev/*` — 47 endpoints discovered, 312 parameters tested.
- **Out of scope.** All other hosts; the `/internal-debug/*` path tree (per environment configuration).
- **Authorization.** Internal pentest ticket INT-4421, signed by the staging-environment owner.
- **Scope level.** Standard — surface scan plus active probes for OWASP-Top-10 vulnerability classes.

---

## 5. Coverage gaps

- **Authenticated admin paths.** Recon was given a low-privilege test account but no admin account. Findings on `/admin/*` are limited to issues an authenticated non-admin can reach.
- **WAF rate-limiting.** Three endpoints under `/api/v1/billing/*` returned `429 Too Many Requests` after 12 probes each. The crawl skipped the remaining parameters on those endpoints.
- **Background jobs.** Recon does not exercise asynchronous job queues or scheduled tasks. Issues that only manifest in background processing are out of scope.

---

## 6. Audit trail

| Phase | Started | Finished | Notes |
|-------|---------|----------|-------|
| Reconnaissance | 14:02 | 14:08 | 47 endpoints discovered. |
| Surface analysis | 14:08 | 14:14 | TLS, headers, exposed paths. |
| Active probing | 14:14 | 14:28 | 312 parameters tested. |
| Confirmation | 14:28 | 14:30 | 7 candidate findings; 7 confirmed. |
| Reporting | 14:30 | 14:31 | Report written. |

**Authorization record.** User `engineer@acme.dev`, IP `198.51.100.42`, recorded 2026-04-22 14:01:53 UTC, target `https://example-staging.acme.dev`, scope `standard`, reference `INT-4421`.

---

Related:

- [Reading reports](reading-reports.md) — what each section means.
- [Understanding findings](understanding-findings.md) — severity rubric.
- [Quickstart](quickstart.md) — launch your own scan.
