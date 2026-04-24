import { test, expect } from '@playwright/test';
import { assertNoBannedVocabulary } from '../fixtures/recon-mock-executor';

test.describe.configure({ mode: 'serial' });

const BREAKPOINTS = [
  { width: 360, height: 640, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1024, height: 768, label: 'laptop' },
  { width: 1440, height: 900, label: 'desktop' },
];

test.describe('Landing — Recon feature section (end-to-end)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#recon').scrollIntoViewIfNeeded();
  });

  for (const bp of BREAKPOINTS) {
    test(`visible at ${bp.label} (${bp.width}x${bp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      const section = page.locator('#recon');
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      await expect(section.getByRole('heading').first()).toBeVisible();
    });
  }

  test('primary CTA routes to /signup?ref=recon', async ({ page }) => {
    await page.getByRole('button', { name: /Try Recon/i }).click();
    await page.waitForURL(/\/signup\?ref=recon/);
  });

  test('sample-report modal opens and closes with focus trap', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /See a sample report/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Focus should be trapped inside the dialog — the close button (or first
    // focusable element) receives focus.
    await expect(async () => {
      const activeTag = await page.evaluate(
        () => document.activeElement?.tagName.toLowerCase() ?? '',
      );
      expect(['button', 'div']).toContain(activeTag);
    }).toPass({ timeout: 2000 });

    // Tab cycles through focusable elements without escaping the dialog.
    await page.keyboard.press('Tab');
    const activeInsideDialog = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(activeInsideDialog).toBe(true);

    // Escape closes the dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('no banned vocabulary in rendered page', async ({ page }) => {
    await assertNoBannedVocabulary(page);
  });

  test('RTL variant: section still renders with rtl direction on html', async ({
    page,
  }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.locator('#recon').scrollIntoViewIfNeeded();
    await expect(page.locator('#recon')).toBeVisible();
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });
});
