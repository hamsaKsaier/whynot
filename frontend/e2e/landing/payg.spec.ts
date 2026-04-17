import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Landing PAYG Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#payg-heading').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('credit breakdown table shows 7 event rows', async ({ page }) => {
    const rows = page.locator('section[aria-labelledby="payg-heading"] tbody tr');
    await expect(rows).toHaveCount(7);
  });

  test('calculator input updates total and recommended pack', async ({ page }) => {
    const calculator = page.locator('[data-testid="credit-calculator"]');
    const firstInput = calculator.locator('input[type="number"]').first();

    await firstInput.fill('100');
    await page.waitForTimeout(500);

    const total = page.locator('[data-testid="total-credits"]');
    const text = await total.textContent();
    expect(text).not.toBe('0');

    await expect(page.locator('[data-testid="recommended-pack"]')).toBeVisible();
  });

  test('expand worked example shows content', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /worked example/i });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await page.waitForTimeout(300);

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/SaaS team with 20 engineers/)).toBeVisible();
  });

  test('credit pack cards rendered', async ({ page }) => {
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('Scale')).toBeVisible();
    await expect(page.getByText('Best value')).toBeVisible();
  });

  test('a11y: all inputs have labels', async ({ page }) => {
    const calculator = page.locator('[data-testid="credit-calculator"]');
    const inputs = calculator.locator('input[type="number"]');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      expect(id || ariaLabel).toBeTruthy();
    }
  });

  test('a11y: zero critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('section[aria-labelledby="payg-heading"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test.describe('RTL', () => {
    test('calculator input direction correct in Arabic', async ({ page }) => {
      await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
      await page.locator('#payg-heading').scrollIntoViewIfNeeded();

      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');

      const calculator = page.locator('[data-testid="credit-calculator"]');
      await expect(calculator).toBeVisible();
    });
  });

  test.describe('visual regression', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const dir of [
        { lng: 'en', label: 'ltr' },
        { lng: 'ar', label: 'rtl' },
      ] as const) {
        test(`payg-${theme}-${dir.label}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/?lng=${dir.lng}`, { waitUntil: 'networkidle' });
          const section = page.locator('section[aria-labelledby="payg-heading"]');
          await section.scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);

          await expect(section).toHaveScreenshot(
            `payg-${theme}-${dir.label}.png`,
            { maxDiffPixelRatio: 0.01 },
          );
        });
      }
    }
  });
});
