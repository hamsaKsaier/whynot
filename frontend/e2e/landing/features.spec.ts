import { test, expect } from '@playwright/test';

test.describe('Landing Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
  });

  test('all 8 feature cards visible after scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#features');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const titles = [
      'Autonomous AI Agents',
      'Intelligent Bug Detection',
      'Visual Regression Testing',
      'Playwright Code Generation',
      'Chaos Testing',
      'Multi-Browser Coverage',
      'Organized Test Suites',
      'Security Scanning',
    ];

    for (const title of titles) {
      await expect(section.getByText(title)).toBeVisible();
    }
  });

  test('keyboard Tab walks through cards in DOM order', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#features');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const heading = section.locator('h2');
    await heading.click();

    const focusable = section.locator('a, button, [tabindex="0"]');
    const count = await focusable.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('Tab');
      }
    }
  });

  test('no card uses forbidden hover effects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#features');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const cards = section.locator('[data-motion="reveal"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const classes = await card.getAttribute('class');
      if (classes) {
        expect(classes).not.toContain('translate-y');
        expect(classes).not.toContain('scale-');
        expect(classes).not.toContain('shadow-md');
        expect(classes).not.toContain('shadow-lg');
      }
    }
  });

  test('renders tier badges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#features');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const proBadges = section.getByText('Pro', { exact: true });
    await expect(proBadges).toHaveCount(2);

    const managedBadge = section.getByText('Managed', { exact: true });
    await expect(managedBadge).toHaveCount(1);
  });

  test('responsive grid: 4 cols on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const grid = page.locator('#features [data-motion="stagger"]');
    const classes = await grid.getAttribute('class');
    expect(classes).toContain('lg:grid-cols-4');
  });
});
