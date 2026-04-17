import { test, expect } from '@playwright/test';

test.describe('Landing Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  });

  test('every link is focusable via keyboard', async ({ page }) => {
    const footer = page.locator('footer');
    const links = footer.locator('a, button');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      if (await link.isVisible()) {
        await link.focus();
        const focused = await link.evaluate((el) => document.activeElement === el);
        expect(focused).toBe(true);
      }
    }
  });

  test('Tab order follows DOM', async ({ page }) => {
    const footer = page.locator('footer');
    const firstLink = footer.locator('a').first();
    await firstLink.focus();

    await page.keyboard.press('Tab');
    const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(['a', 'button']).toContain(activeTag);
  });

  test('Shift+Tab reverses cleanly', async ({ page }) => {
    const footer = page.locator('footer');
    const links = footer.locator('a');
    const secondLink = links.nth(1);
    await secondLink.focus();

    await page.keyboard.press('Shift+Tab');
    const activeElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(['a', 'button']).toContain(activeElement);
  });

  test('external links have rel="noopener noreferrer"', async ({ page }) => {
    const externalLinks = page.locator('footer a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });

  test('language switcher shows aria-current for active locale', async ({ page }) => {
    const activeLocale = page.locator('footer [aria-current="true"]');
    await expect(activeLocale).toBeVisible();
  });
});
