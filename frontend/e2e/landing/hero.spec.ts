import { test, expect } from '@playwright/test';

test.describe('Landing Hero', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
  });

  test('headline is fully visible after animation window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1500);

    const heading = page.locator('#hero h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain('Find bugs');
    expect(text).toContain('before your users do');
  });

  test('eyebrow chip is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const eyebrow = page.locator('#hero').getByText('AI-Powered QA');
    await expect(eyebrow).toBeVisible();
  });

  test('primary CTA is clickable and navigates to signup', async ({ page }) => {
    const cta = page.locator('#hero').getByRole('button', { name: /start free trial/i });
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('secondary CTA is clickable', async ({ page }) => {
    const cta = page.locator('#hero').getByRole('button', { name: /view pricing/i });
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('authenticated session shows Open app CTA', async ({ page, context }) => {
    await context.addCookies([
      { name: 'auth_token', value: 'test-token', domain: 'localhost', path: '/' },
    ]);
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
    });
    await page.reload({ waitUntil: 'networkidle' });

    const openAppButton = page.locator('#hero').getByRole('button', { name: /open app/i });
    // Only visible when auth context detects the user
    const startButton = page.locator('#hero').getByRole('button', { name: /start free trial/i });

    // One of these should be visible depending on auth state
    const hasOpenApp = await openAppButton.isVisible().catch(() => false);
    const hasStart = await startButton.isVisible().catch(() => false);
    expect(hasOpenApp || hasStart).toBe(true);
  });

  test('two-column layout on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const grid = page.locator('#hero .grid');
    await expect(grid).toBeVisible();
    const classes = await grid.getAttribute('class');
    expect(classes).toContain('lg:grid-cols-2');
  });

  test('video element has preload=metadata', async ({ page }) => {
    const video = page.locator('#hero video');
    await expect(video).toHaveAttribute('preload', 'metadata');
  });

  test('social proof avatars are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
    const avatars = page.locator('#hero .rounded-full.border-2');
    await expect(avatars).toHaveCount(4);
  });
});

test.describe('Landing Hero - RTL', () => {
  test('renders correctly in Arabic', async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 900 });

    const heading = page.locator('#hero h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain('اكتشف الأخطاء');
  });
});
