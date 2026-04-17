---
title: "Credit Calculator"
description: "Estimate your monthly credit usage and find the right plan with example scenarios and optimization tips."
lang: en
draft: false
---

# Credit Calculator

## How to use the credit calculator

The credit calculator helps you estimate your expected credit consumption and find the right plan. Simply enter the number of operations you plan to run per month — the calculator automatically computes the credits you need and the associated cost.

### Step-by-step walkthrough

1. **Navigate to the credit calculator** under **Pricing > Credit Calculator** on the WhyNot website.
2. **Enter your estimated monthly usage** for each operation type:
   - Test generations per month
   - Test executions per month
   - QA loops per month
   - Auto-fix runs per month
   - Visual regression tests per month
   - QA monitor cycles per month
   - CI scans per month
3. **Review the results.** The calculator displays:
   - Total credits required per month
   - Recommended plan
   - Recommended credit pack (if extra credits are needed)
   - Estimated total monthly cost
4. **Adjust the inputs** to model different usage scenarios.

### Reference: credit cost per operation

| Operation | Credits |
|-----------|---------|
| Test generation | 50 |
| Test execution | 10 |
| QA loop | 30 |
| Auto-fix | 100 |
| Visual regression | 15 |
| QA monitor (per cycle) | 200 |
| CI scan (per run) | 200 |

---

## Example scenarios

The following three scenarios illustrate typical usage patterns for teams of different sizes. All calculations are based on average values and are intended as a reference.

---

### Scenario 1: Small team (5 engineers)

**Profile:** A startup or small engineering team using WhyNot for basic test automation.

**Estimated monthly usage:**

| Operation | Quantity/month | Credits/operation | Total credits |
|-----------|----------------|-------------------|---------------|
| Test generation | 40 | 50 | 2,000 |
| Test execution | 200 | 10 | 2,000 |
| QA loop | 20 | 30 | 600 |
| Auto-fix | 10 | 100 | 1,000 |
| Visual regression | 30 | 15 | 450 |
| QA monitor | 0 | 200 | 0 |
| CI scan | 20 | 200 | 4,000 |
| **Total** | | | **10,050** |

**Recommendation:**

- **Plan:** Pro BYO ($29/month) — includes 2,000 credits
- **Extra credits needed:** 8,050 credits
- **Credit pack:** 1x Growth (10,000 credits / $80)
- **Estimated monthly cost:** $29 + $80 = **$109/month**
- **Per engineer:** approx. $21.80/month

**Note:** With annual plan billing, the plan cost drops to $23.20/month, bringing the total to about $103.20/month.

---

### Scenario 2: Mid-size team (20 engineers)

**Profile:** An established engineering team with regular release cycles and comprehensive test coverage.

**Estimated monthly usage:**

| Operation | Quantity/month | Credits/operation | Total credits |
|-----------|----------------|-------------------|---------------|
| Test generation | 150 | 50 | 7,500 |
| Test execution | 1,000 | 10 | 10,000 |
| QA loop | 80 | 30 | 2,400 |
| Auto-fix | 40 | 100 | 4,000 |
| Visual regression | 100 | 15 | 1,500 |
| QA monitor | 10 | 200 | 2,000 |
| CI scan | 60 | 200 | 12,000 |
| **Total** | | | **39,400** |

**Recommendation:**

- **Plan:** Pro Managed ($49/month) — includes 5,000 credits, unlimited QA monitors and CI scans
- **Extra credits needed:** 34,400 credits
- **Credit pack:** 4x Growth (40,000 credits / $320) — enough for most months; add another Growth pack for higher-usage months
- **Estimated monthly cost:** $49 + $320 = **$369/month**
- **Per engineer:** approx. $18.45/month

**Alternative:** If you regularly need more than 39,000 credits per month, the Scale pack (100,000 credits / $600) makes sense. Monthly cost would be $49 + $600 = $649 with plenty of headroom for peak months. Per engineer that works out to about $32.45/month — but with significant buffer.

---

### Scenario 3: Large team (50+ engineers)

**Profile:** An enterprise team with extensive CI/CD integration, continuous QA monitoring, and high test volume.

**Estimated monthly usage:**

| Operation | Quantity/month | Credits/operation | Total credits |
|-----------|----------------|-------------------|---------------|
| Test generation | 500 | 50 | 25,000 |
| Test execution | 5,000 | 10 | 50,000 |
| QA loop | 200 | 30 | 6,000 |
| Auto-fix | 150 | 100 | 15,000 |
| Visual regression | 300 | 15 | 4,500 |
| QA monitor | 50 | 200 | 10,000 |
| CI scan | 150 | 200 | 30,000 |
| **Total** | | | **140,500** |

**Recommendation:**

- **Plan:** Pro Managed ($49/month) — includes 5,000 credits
- **Extra credits needed:** 135,500 credits
- **Credit pack:** 2x Scale (200,000 credits / $1,200) — covers the need with reserve
- **Estimated monthly cost:** $49 + $1,200 = **$1,249/month**
- **Per engineer:** approx. $24.98/month

**Note:** If your team consumes more than 100,000 credits per month, we recommend contacting our sales team. We offer custom enterprise agreements with volume discounts beyond the Scale pack.

---

## Tips for optimizing your credit consumption

### 1. Use test generation deliberately

Test generations (50 credits) are significantly more expensive than test executions (10 credits). Generate tests once and reuse them rather than regenerating on every run. For a team of 5 engineers generating 10 tests each and running them 10 times, you save about 2,000 credits per month compared to regenerating on every run.

### 2. Use auto-fix thoughtfully

Auto-fix is the second most expensive operation at 100 credits per run. Review simple failures manually and reserve auto-fix for complex issues where the automated correction actually saves engineering time.

### 3. Adjust QA monitor intervals

Each QA monitor cycle consumes 200 credits. Check whether your monitoring frequency matches your actual need. Not every endpoint must be probed every 5 minutes — for many use cases, a 30-minute or hourly interval is sufficient.

### 4. Optimize CI scans

CI scans (200 credits per run) can add up quickly with frequent commits. Consider:

- Running CI scans on pull requests only (not every commit)
- Excluding feature branches from full scans
- Scoping scans to critical paths

### 5. Pick the right credit pack

Analyze your usage over the past 2–3 months before selecting a pack. A pack that's too small means a higher per-credit cost; a pack that's too large risks unused credits expiring. Rule of thumb: pick a pack that exceeds your average monthly need by 10–20%.

### 6. Use annual billing

If you're confident you'll use WhyNot long term, annual billing saves 20% on plan costs. On the Pro Managed plan that's $117.60 in savings per year.

### 7. Review usage reports regularly

Under **Settings > Billing > Credits > Usage history** you can analyze consumption by operation type and time range. Use this data to:

- Spot unusually high usage early
- Identify optimization opportunities
- Right-size the pack for next month

---

## Summary

| Team size | Credits/month | Recommended plan | Credit pack | Cost/month | Cost/engineer |
|-----------|---------------|------------------|-------------|------------|---------------|
| 5 engineers | ~10,000 | Pro BYO | 1x Growth | ~$109 | ~$21.80 |
| 20 engineers | ~39,400 | Pro Managed | 4x Growth | ~$369 | ~$18.45 |
| 50+ engineers | ~140,500 | Pro Managed | 2x Scale | ~$1,249 | ~$24.98 |

The credit calculator is available at any time to model your specific scenarios. For enterprise inquiries, please contact sales@whynot.com.
