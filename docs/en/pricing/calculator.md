# Credit Calculator

The credit calculator helps you estimate your monthly credit usage and recommended pack before purchasing.

## How to use

1. Navigate to the **Pricing** section on the landing page.
2. Scroll to the **Credit calculator** card.
3. Enter your estimated monthly usage for each operation type:
   - Test generations
   - Test executions
   - QA loop iterations
   - Auto-fix attempts
   - Visual regressions
   - QA monitor sessions
   - CI scans
4. The calculator displays:
   - **Total credits** — sum of (quantity × credits per operation).
   - **Estimated monthly cost** — based on the most cost-effective pack for your volume.
   - **Recommended pack** — the pack that gives you the best per-credit rate at your usage level.

## Example scenarios

### Small team (5 engineers, weekly releases)

| Operation | Monthly quantity | Credits |
|-----------|-----------------|---------|
| Test generation | 20 | 1,000 |
| Test execution | 100 | 1,000 |
| Auto-fix attempts | 5 | 500 |
| **Total** | | **2,500** |

Recommended pack: **Starter** ($10 × 3 packs = $30/month).

### Mid-size team (20 engineers, 3× weekly releases)

| Operation | Monthly quantity | Credits |
|-----------|-----------------|---------|
| Test generation | 50 | 2,500 |
| Test execution | 200 | 2,000 |
| Auto-fix attempts | 10 | 1,000 |
| **Total** | | **5,500** |

Recommended pack: **Starter** ($10 × 6 packs = $60/month).

### Large team (50+ engineers, daily releases)

| Operation | Monthly quantity | Credits |
|-----------|-----------------|---------|
| Test generation | 200 | 10,000 |
| Test execution | 1,000 | 10,000 |
| QA loop iterations | 100 | 3,000 |
| Auto-fix attempts | 50 | 5,000 |
| Visual regressions | 200 | 3,000 |
| CI scans | 20 | 4,000 |
| **Total** | | **35,000** |

Recommended pack: **Growth** ($80 × 4 packs = $320/month).

## Tips

- Start with a conservative estimate and adjust after your first month.
- The calculator uses the same rates as your actual billing — no hidden fees.
- Credits from larger packs are always cheaper per unit.
