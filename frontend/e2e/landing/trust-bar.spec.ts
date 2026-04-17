import { test, expect } from '@playwright/test';

test.describe('Landing TrustBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
  });

  test('stat numbers finalize to formatted values (en)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const trustSection = page.locator('section[aria-label="Trust indicators and supported technologies"]');
    await trustSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    const countUps = trustSection.locator('[data-motion="count-up"]');
    await expect(countUps).toHaveCount(4);

    const texts = await countUps.allTextContents();
    expect(texts.some((t) => t.includes('50,000') || t.includes('50000'))).toBe(true);
    expect(texts.some((t) => t.includes('120,000') || t.includes('120000'))).toBe(true);
    expect(texts.some((t) => t.includes('500'))).toBe(true);
    expect(texts.some((t) => t.includes('99.2') || t.includes('99,2'))).toBe(true);
  });

  test('marquee pauses on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const marquee = page.locator('[data-motion="marquee"]').first();
    await marquee.scrollIntoViewIfNeeded();

    await marquee.hover();
    const inner = marquee.locator('[style*="animation"]').first();
    const style = await inner.getAttribute('style');
    expect(style).toContain('paused');
  });

  test('trust badges are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(page.getByText('SOC 2 Compliant')).toBeVisible();
    await expect(page.getByText('Data encrypted at rest')).toBeVisible();
    await expect(page.getByText('30-day money-back guarantee')).toBeVisible();
    await expect(page.getByText('99.9% uptime SLA')).toBeVisible();
  });
});

test.describe('TrustBar - Locale stats', () => {
  const locales = [
    { lng: 'en', label: 'English' },
    { lng: 'ar', label: 'Arabic' },
    { lng: 'fr', label: 'French' },
    { lng: 'de', label: 'German' },
    { lng: 'es', label: 'Spanish' },
  ];

  for (const { lng, label } of locales) {
    test(`stat numbers render for ${label} (${lng})`, async ({ page }) => {
      await page.goto(`/?lng=${lng}`, { waitUntil: 'networkidle' });
      await page.setViewportSize({ width: 1440, height: 900 });

      const trustSection = page.locator('section').filter({ has: page.locator('[data-motion="marquee"]') });
      await trustSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);

      const countUps = trustSection.locator('[data-motion="count-up"]');
      await expect(countUps).toHaveCount(4);

      const texts = await countUps.allTextContents();
      expect(texts.length).toBe(4);
      for (const text of texts) {
        expect(text.length).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('TrustBar - A11y', () => {
  test('section has aria-label', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    const section = page.locator('section[aria-label="Trust indicators and supported technologies"]');
    await expect(section).toBeVisible();
  });
});
