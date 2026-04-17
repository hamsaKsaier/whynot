import { test, expect } from '@playwright/test';

test.describe('Sticky Bottom CTA', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
  });

  test('appears after scrolling past hero', async ({ page }) => {
    // Initially not visible
    const region = page.locator('[role="region"][aria-label="Quick action bar"]');
    await expect(region).not.toBeVisible();

    // Scroll past hero
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    await expect(region).toBeVisible();
    await expect(page.getByText('Find bugs before your users do.')).toBeVisible();
  });

  test('has CTA and dismiss buttons', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const ctaButton = page.getByRole('button', { name: /start free/i });
    const dismissButton = page.getByRole('button', { name: /dismiss/i });

    await expect(ctaButton).toBeVisible();
    await expect(dismissButton).toBeVisible();
  });

  test('dismiss hides the bar and persists on reload', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const region = page.locator('[role="region"][aria-label="Quick action bar"]');
    await expect(region).toBeVisible();

    await page.getByRole('button', { name: /dismiss/i }).click();
    await page.waitForTimeout(300);
    await expect(region).not.toBeVisible();

    // Verify localStorage was set
    const stored = await page.evaluate(() =>
      localStorage.getItem('landing.stickyCTA.dismissed'),
    );
    expect(stored).toBeTruthy();

    // Reload and scroll — should stay hidden
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);
    await expect(region).not.toBeVisible();
  });

  test('re-appears after simulated 31-day skip', async ({ page }) => {
    // Set dismiss date to 31 days ago
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate(
      (date) => localStorage.setItem('landing.stickyCTA.dismissed', date),
      thirtyOneDaysAgo,
    );

    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const region = page.locator('[role="region"][aria-label="Quick action bar"]');
    await expect(region).toBeVisible();
  });

  test('hidden on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const region = page.locator('[role="region"][aria-label="Quick action bar"]');
    await expect(region).not.toBeVisible();
  });

  test('has correct accessibility attributes', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const region = page.locator('[role="region"][aria-label="Quick action bar"]');
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAttribute('aria-label', 'Quick action bar');
  });
});

test.describe('Sticky Bottom CTA - RTL', () => {
  test('renders in Arabic', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);

    const region = page.locator('[role="region"]');
    await expect(region).toBeVisible();
    await expect(page.getByText('اكتشف الأخطاء قبل مستخدميك.')).toBeVisible();
  });
});
