import { test, expect } from '@playwright/test';

test.describe('Landing Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
  });

  test('desktop nav click scrolls to anchor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });

    const featuresSection = page.locator('#features');
    const featuresLink = page.locator('header nav button', { hasText: 'Features' });

    await featuresLink.click();
    await page.waitForTimeout(800);

    const box = await featuresSection.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeLessThan(200);
  });

  test('mobile sheet open → link click → navigates + closes', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });

    const menuButton = page.locator('header button[aria-label="Menu"]');
    await menuButton.click();
    await page.waitForTimeout(300);

    const sheetNav = page.locator('[data-state="open"] nav');
    await expect(sheetNav).toBeVisible();

    const featuresLink = sheetNav.locator('button', { hasText: 'Features' });
    await featuresLink.click();
    await page.waitForTimeout(800);

    await expect(sheetNav).not.toBeVisible();
  });

  test('language switch round-trip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });

    const langButton = page.locator('header button[aria-label="Change language"]');
    await langButton.click();

    const frOption = page.getByText('Français');
    await frOption.click();
    await page.waitForTimeout(500);

    const htmlDir = await page.locator('html').getAttribute('lang');
    expect(htmlDir).toBe('fr');

    await langButton.click();
    const enOption = page.getByText('English');
    await enOption.click();
    await page.waitForTimeout(500);

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('theme toggle persists across reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });

    const themeBtn = page.locator('header button[aria-label*="Switch to"]').first();
    const initialLabel = await themeBtn.getAttribute('aria-label');
    await themeBtn.click();
    await page.waitForTimeout(300);

    const newLabel = await page.locator('header button[aria-label*="Switch to"]').first().getAttribute('aria-label');
    expect(newLabel).not.toBe(initialLabel);

    await page.reload({ waitUntil: 'networkidle' });
    const afterReloadLabel = await page.locator('header button[aria-label*="Switch to"]').first().getAttribute('aria-label');
    expect(afterReloadLabel).toBe(newLabel);
  });

  test('scroll past threshold adds data-scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });

    const header = page.locator('header');
    await expect(header).toHaveAttribute('data-scrolled', 'false');

    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(200);

    await expect(header).toHaveAttribute('data-scrolled', 'true');
  });
});
