import { test, expect } from '@playwright/test';

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('no animated transforms after load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const motionElements = page.locator('[data-motion]');
    const count = await motionElements.count();

    for (let i = 0; i < count; i++) {
      const el = motionElements.nth(i);
      const transform = await el.evaluate(
        (node) => window.getComputedStyle(node).transform,
      );
      const motionType = await el.getAttribute('data-motion');
      expect(
        transform === 'none' || transform === '' || transform === 'matrix(1, 0, 0, 1, 0, 0)',
        `[data-motion="${motionType}"] should have no transform with reduced motion, got: ${transform}`,
      ).toBeTruthy();
    }
  });

  test('no animation styles on marquee with reduced motion', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const marquees = page.locator('[data-motion="marquee"]');
    const count = await marquees.count();

    for (let i = 0; i < count; i++) {
      const children = marquees.nth(i).locator('[style*="animation"]');
      const childCount = await children.count();
      expect(childCount).toBe(0);
    }
  });
});
