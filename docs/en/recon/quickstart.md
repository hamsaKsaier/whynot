---
title: "Recon Quickstart"
description: "Run your first Recon scan in about five minutes."
lang: en
draft: false
---

# Recon Quickstart

Run your first Recon scan in about five minutes. This guide walks you through the new-scan wizard end-to-end, from authorization to first findings.

Before you start:

- You must be a workspace owner or have the `recon.scan.create` permission.
- The workspace must have the `recon_enabled` flag turned on. Ask your admin if you cannot see the Recon section in the sidebar.
- You must have the legal right to scan the target environment. Read [Authorization & responsible use](responsible-use.md) first.

---

## Step 1 — Open the new-scan wizard

1. In the sidebar, click **Recon**.
2. On the Recon landing page, click **New scan**.

The wizard opens on a four-step flow: **Target → Authorization → Scope → Review**.

## Step 2 — Pick your target

Fill in the target panel:

| Field | What to enter |
|-------|---------------|
| **Environment** | The environment to scan. Environments tagged `production` display a prominent warning — see below. |
| **Base URL** | The root URL the scan starts from. Must be `https://` in most workspaces. |
| **Repository (optional)** | Link a connected git repository so Recon can reason about your source code as well as the live site. |
| **Scan name** | A short label. Defaults to the environment name plus the current date. |

> **Production warning.** If you pick an environment tagged `production`, Recon shows a yellow warning. Recon will still run the scan — you explicitly authorized it — but you should be sure you want live traffic and active probes hitting production. If in doubt, pick a staging or preview environment instead.

## Step 3 — Confirm authorization

Every scan requires a **per-scan authorization** record. This is a legal gate, not a UX nicety: you are telling the platform, in writing, that you have permission to scan this target.

In the authorization panel:

1. Tick **I am authorized to scan this target.**
2. Tick **I understand this scan will send active probes.**
3. Enter the **legal entity** you represent (e.g. your company name).
4. Optionally paste a reference to your written authorization (ticket ID, email thread, contract).

When you submit, Recon writes an immutable row to the authorization audit log tied to your user, IP, timestamp, and the exact target URL. You can review it later under **Settings → Recon → Audit log**.

If you cannot tick all three boxes, stop. You do not have authorization yet.

## Step 4 — Choose the scope

Scope controls how broad and deep the scan goes.

- **Surface scan** — passive reconnaissance only. Fast, low-cost, no active probing.
- **Standard scan** — surface scan plus active probes for common vulnerability classes. Recommended for most workspaces.
- **Deep scan** — standard scan plus authenticated probing and longer crawl budgets. Uses the most credits.

Each option shows its estimated credit cost before you commit. You can also set a **per-scan credit cap** under **Settings → Recon**; scans that would exceed the cap are terminated before the next paid phase.

## Step 5 — Review and launch

The final panel summarizes everything: target, authorization, scope, estimated cost, and any warnings. When you click **Launch scan**, Recon:

1. Writes the scan row.
2. Writes the authorization row.
3. Enqueues the scan.
4. Redirects you to the scan-detail page.

## What happens next

- The scan-detail page updates in real time as each phase completes.
- When the scan finishes, findings appear under the **Findings** tab.
- Each finding includes a severity rating, a proof-of-concept, and a recommended remediation. See [Understanding findings](understanding-findings.md).
- Reports can be shared and exported as PDF. See [Reading reports](reading-reports.md).

## You're done

From here, read:

- [Authorization & responsible use](responsible-use.md) — your legal obligations.
- [Understanding findings](understanding-findings.md) — how to read severity, exploit outcomes, and false-positive flags.
- [Quotas and billing](quotas.md) — what a scan costs on each plan.
- [Troubleshooting](troubleshooting.md) — when a scan gets stuck or errors out.
