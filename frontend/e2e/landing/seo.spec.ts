import { test, expect } from '@playwright/test';

const locales = ['en', 'ar', 'fr', 'de', 'es'] as const;

for (const locale of locales) {
  test.describe(`SEO — ${locale}`, () => {
    test(`has correct title, description, canonical, hreflang`, async ({ page }) => {
      await page.goto(`/?lng=${locale}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(title).toContain('WhyNot');

      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description).toBeTruthy();
      expect(description!.length).toBeGreaterThan(20);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe('https://whynot.sh');

      const hreflangs = page.locator('link[rel="alternate"][hreflang]');
      const count = await hreflangs.count();
      expect(count).toBe(6);

      for (const lang of locales) {
        const link = page.locator(`link[hreflang="${lang}"]`);
        await expect(link).toHaveAttribute('href', `https://whynot.sh/?lng=${lang}`);
      }

      const xDefault = page.locator('link[hreflang="x-default"]');
      await expect(xDefault).toHaveAttribute('href', 'https://whynot.sh');
    });

    test('has og:locale and twitter:site', async ({ page }) => {
      await page.goto(`/?lng=${locale}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
      expect(ogLocale).toBeTruthy();

      const twitterSite = await page.locator('meta[name="twitter:site"]').getAttribute('content');
      expect(twitterSite).toBe('@whynotqa');

      const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
      expect(twitterCard).toBe('summary_large_image');
    });
  });
}
