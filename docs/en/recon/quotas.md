---
title: "Recon — Quotas and billing"
description: "Plan inclusions, pay-as-you-go rates, partial-scan billing, and per-scan credit caps for Recon."
lang: en
draft: false
---

# Quotas and billing

Recon scans consume **credits** from your workspace's monthly allowance. When you exceed the allowance, additional credits are billed at the pay-as-you-go (PAYG) rate. This page explains what's included, what costs extra, and how partial-scan billing works.

For pricing of the underlying plans (Free, Pro BYO, Pro Managed), see the live [pricing page](/pricing).

---

## What's included by plan

| Plan | Recon scans included | Surface scan | Standard scan | Deep scan |
|------|----------------------|--------------|---------------|-----------|
| **Free** | 1/month, surface only | ✓ | — | — |
| **Pro BYO** | 5/month, any scope | ✓ | ✓ | ✓ |
| **Pro Managed** | Unlimited (fair use), any scope | ✓ | ✓ | ✓ |

Included scans count against the included credits in your monthly allowance. Once those are used up, additional scans are billed at PAYG rates.

## Credit cost per scan

The exact credit cost depends on the target's complexity (number of endpoints, parameters, response size), but the typical ranges are:

| Scope | Typical credits | Notes |
|-------|-----------------|-------|
| Surface | 50–200 | Passive reconnaissance, no active probing. |
| Standard | 500–2,000 | Surface + active probes for common vulnerability classes. |
| Deep | 2,000–10,000 | Standard + authenticated probing + extended crawl. |

The wizard shows the **estimated cost** for the chosen scope before you launch. The final cost is computed after the scan finishes and is displayed on the scan-detail page.

## Pay-as-you-go rates

When you exceed your included credits, additional credits are billed at the standard PAYG rate. See the [PAYG documentation](../pricing/payg.md) for the live per-credit price and any volume discounts.

## Partial-scan billing

Sometimes a scan ends before completing every phase — you cancel it, the per-scan credit cap is hit, or a transient failure terminates it. In these cases:

- You are billed for **completed phases only**.
- A phase that started but did not finish is **not** billed.
- The scan-detail page shows the exact phase-by-phase cost breakdown.

If a scan fails entirely without producing useful data, the cost is automatically refunded to your workspace within 24 hours. You don't need to file a support ticket for routine failures.

## Per-scan credit cap

To prevent surprise bills on a misconfigured target, set a **per-scan credit cap** under **Settings → Recon**.

| Cap value | Effect |
|-----------|--------|
| `0` | No workspace-level cap. The platform default applies. |
| `1` to `100000` | Hard cap for a single scan. Recon terminates the scan before the next paid phase that would exceed the cap. |

The cap is enforced before each phase starts, so you may pay slightly less than the cap (whatever the last completed phase cost) but never more.

Recommended starting values:

- **Free / evaluation** — leave at `0` (no cap; trust the included allowance).
- **Pro BYO** — set to `5000` if you scan production targets regularly.
- **Pro Managed** — set to `15000` if you run frequent deep scans.

Adjust based on your actual scan history; the scan-detail page shows the cost of every previous scan you've run.

## Quota visibility

Recon usage is shown in two places:

- **Settings → Billing → Usage**, alongside other product usage (test runs, AI generations, etc.).
- **Recon → Settings → Recon → Usage**, with a Recon-only breakdown including PAYG charges.

Both views are real-time. There is no end-of-month surprise.

## Hard guarantees

- **No surprise charges.** A scan that would exceed your per-scan cap is terminated, not billed past the cap.
- **No retroactive price changes.** If we change PAYG rates, the new rate applies to scans launched after the change. Scans in flight are billed at the rate at launch time.
- **No overage without warning.** When you cross 80% of your monthly allowance, the billing contact is emailed.

## Frequently asked questions

**Does a failed scan cost credits?**
You are billed for completed phases only. A phase that did not finish is not billed. A scan that fails before any phase completes is fully refunded within 24 hours.

**Does a re-scan of the same target cost less?**
No. Each scan is independent. We don't currently offer caching across scans.

**Can I share included scans across workspaces?**
No. Included scans belong to the workspace they are issued to.

**What counts as a "scan" for the Free plan's monthly limit?**
Any successfully launched scan, even if you cancel it before it completes. A scan that the gateway rejects (e.g. authorization missing, flag disabled) does not count.

---

Related:

- [Pricing — plans](../pricing/plans.md) — overall plan inclusions.
- [Pricing — pay-as-you-go](../pricing/payg.md) — PAYG rates and volume discounts.
- [Quickstart](quickstart.md) — how to launch your first scan.
