import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

const themes = ['light', 'dark'] as const;
const directions = [
  { name: 'ltr', locale: 'en' },
  { name: 'rtl', locale: 'ar' },
] as const;

for (const viewport of viewports) {
  for (const theme of themes) {
    for (const dir of directions) {
      test(`landing-${viewport.name}-${theme}-${dir.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        if (theme === 'dark') {
          await page.emulateMedia({ colorScheme: 'dark' });
        } else {
          await page.emulateMedia({ colorScheme: 'light' });
        }

        await page.goto(`/?lng=${dir.locale}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot(
          `landing-${viewport.name}-${theme}-${dir.name}.png`,
          { maxDiffPixelRatio: 0.01, fullPage: true },
        );
      });
    }
  }
}
