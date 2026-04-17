---
title: "Pay-as-you-go Credits"
description: "Buy credits beyond your plan allowance. Learn how credits work, what each operation costs, and which pack fits your usage."
lang: en
draft: false
---

# Pay-as-you-go Credits

## Overview

The pay-as-you-go model lets you buy extra credits beyond your plan allowance. Credits are the currency for every operation on the WhyNot platform. Each operation consumes a fixed number of credits, depending on its complexity and the resources required.

---

## Credit cost per operation

Every operation on the platform has a fixed credit price:

| Operation | Credits per run | Description |
|-----------|-----------------|-------------|
| **Test generation** | 50 | Automatically creates a test case based on your code |
| **Test execution** | 10 | Runs a single test case |
| **QA loop** | 30 | A full QA pass with analysis and report |
| **Auto-fix** | 100 | Automatic defect correction with a code change suggestion |
| **Visual regression** | 15 | Visual diff between two page states (screenshot comparison) |
| **QA monitor** | 200 | Continuous QA monitoring of an endpoint (per cycle) |
| **CI scan** | 200 | Full scan within your CI/CD pipeline (per run) |

### Worked examples

- **Generate and run 10 tests:** 10 × 50 (generation) + 10 × 10 (execution) = 600 credits
- **5 QA loops with auto-fix:** 5 × 30 (QA loop) + 5 × 100 (auto-fix) = 650 credits
- **Daily CI scan (30 days):** 30 × 200 = 6,000 credits

---

## Credit packs

Credits can be bought in three pack sizes. Larger packs have a better per-credit rate:

| Pack | Credits | Price | Per credit | Savings |
|------|---------|-------|------------|---------|
| **Starter** | 1,000 | $10 | $0.0100 | — |
| **Growth** | 10,000 | $80 | $0.0080 | 20% |
| **Scale** | 100,000 | $600 | $0.0060 | 40% |

### Which pack is right for you?

**Starter (1,000 credits / $10):**
Good for occasional usage or trying out pay-as-you-go. Ideal if you're on the Free plan and only need extra capacity from time to time.

**Growth (10,000 credits / $80):**
The best choice for small to mid-size teams with regular usage. You save 20% over the Starter pack and get enough credits for roughly 200 test generations or 1,000 test executions.

**Scale (100,000 credits / $600):**
Ideal for larger teams or companies with high test volume. You save 40% over the Starter pack. This pack works especially well if you rely on CI scans and QA monitors regularly.

---

## How credits work

### Credit consumption

1. **Plan credits are consumed first.** If your plan includes monthly credits, those are used before anything else.
2. **Pay-as-you-go credits kick in automatically.** Once plan credits are exhausted, purchased credits are used.
3. **Multiple packs are consumed in order.** If you own several packs, the oldest pack is used first (FIFO).

### Viewing your credit balance

You can view your current credit balance at any time under **Settings > Billing > Credits**. There you will find:

- Remaining plan credits for the current month
- Remaining pay-as-you-go balance
- Usage history for the last 30 days
- Breakdown by operation type

### Purchasing credits

1. Navigate to **Settings > Billing > Credits**.
2. Pick the credit pack you want.
3. Confirm the purchase with your saved payment method.
4. Credits are added to your account immediately.

---

## Frequently asked questions

### Do purchased credits expire?

Yes. Purchased credit packs are valid for **12 months** from the date of purchase. After that, unused credits expire. Plan credits (those included monthly in your plan) expire at the end of each billing period.

### What happens when I go over (overage)?

If both your plan credits and your pay-as-you-go credits are exhausted, affected operations are **not automatically executed**. You will receive a notification and can then:

- Buy an additional credit pack
- Wait for the next billing period (for new plan credits)
- Upgrade your plan

There are **no surprise charges**. Operations only run when enough credits are available.

### Can I transfer credits between accounts?

No. Credits are tied to your account and cannot be transferred.

### Are credits carried over when I change plans?

Yes. Your purchased pay-as-you-go credits stay with you when you change plans. Unused plan credits from the old plan expire on the switch.

### Are there refunds for unused credits?

No. Purchased credit packs are non-refundable. We recommend starting with a smaller pack to gauge your usage.

### Can I set up automatic credit top-ups?

Yes. Under **Settings > Billing > Credits > Auto top-up** you can set a threshold. When your credit balance drops below that value, the pack you select is purchased automatically.

### Are there volume discounts beyond the Scale pack?

For organizations that need more than 100,000 credits per month, we offer custom agreements. Please contact our sales team at sales@whynot.com.

---

## Credit cost summary

| Operation | Credits | In Starter pack ($10) | In Growth pack ($80) | In Scale pack ($600) |
|-----------|---------|-----------------------|----------------------|----------------------|
| Test generation | 50 | $0.50 | $0.40 | $0.30 |
| Test execution | 10 | $0.10 | $0.08 | $0.06 |
| QA loop | 30 | $0.30 | $0.24 | $0.18 |
| Auto-fix | 100 | $1.00 | $0.80 | $0.60 |
| Visual regression | 15 | $0.15 | $0.12 | $0.09 |
| QA monitor | 200 | $2.00 | $1.60 | $1.20 |
| CI scan | 200 | $2.00 | $1.60 | $1.20 |
