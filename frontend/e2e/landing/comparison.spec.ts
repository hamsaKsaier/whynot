import { test, expect } from '@playwright/test';

test.describe('Landing Comparison - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('all 6 competitor columns visible without scroll', async ({ page }) => {
    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const desktop = section.locator('.hidden.md\\:block');
    await expect(desktop).toBeVisible();

    const competitors = ['WhyNot', 'Selenium', 'Cypress', 'Playwright', 'BrowserStack', 'LambdaTest'];
    for (const name of competitors) {
      await expect(desktop.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('table has proper scope attributes', async ({ page }) => {
    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();

    const colHeaders = section.locator('th[scope="col"]');
    await expect(colHeaders).toHaveCount(14);

    const rowHeaders = section.locator('th[scope="row"]');
    await expect(rowHeaders).toHaveCount(20);
  });

  test('WhyNot column has ring-primary highlight', async ({ page }) => {
    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();

    const highlighted = section.locator('td.ring-1');
    const count = await highlighted.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Landing Comparison - Mobile', () => {
  test('sticky first column while competitors scroll horizontally', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 360, height: 640 });

    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const mobileTable = section.locator('.md\\:hidden');
    await expect(mobileTable).toBeVisible();

    const stickyTh = mobileTable.locator('th.sticky').first();
    await expect(stickyTh).toBeVisible();

    const scrollable = mobileTable.locator('.overflow-x-auto');
    await expect(scrollable).toBeVisible();

    await scrollable.evaluate((el) => {
      el.scrollLeft = 200;
    });
    await page.waitForTimeout(200);

    await expect(stickyTh).toBeVisible();
  });

  test('mobile hint text is visible', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 360, height: 640 });

    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();

    await expect(section.getByText('Scroll to see more')).toBeVisible();
  });
});

test.describe('Landing Comparison - RTL', () => {
  test('table scrolls RTL at ?lng=ar', async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 360, height: 640 });

    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');

    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const mobileTable = section.locator('.md\\:hidden');
    await expect(mobileTable).toBeVisible();

    const stickyTh = mobileTable.locator('th.sticky').first();
    await expect(stickyTh).toBeVisible();
  });

  test('desktop table renders in Arabic', async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();

    await expect(section.getByText('كيف يقارن WhyNot')).toBeVisible();
  });
});

test.describe('Landing Comparison - A11y', () => {
  test('table headers have correct scope', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 900 });

    const section = page.locator('#comparison');
    await section.scrollIntoViewIfNeeded();

    const colHeaders = section.locator('th[scope="col"]');
    expect(await colHeaders.count()).toBeGreaterThanOrEqual(7);

    const rowHeaders = section.locator('th[scope="row"]');
    expect(await rowHeaders.count()).toBeGreaterThanOrEqual(10);
  });
});
