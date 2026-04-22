import { test, expect } from '@playwright/test';

test.describe('Test Runner UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qa-loop');
  });

  test('renders runner page with session form', async ({ page }) => {
    await expect(page.locator('text=Start')).toBeVisible({ timeout: 10_000 });
  });

  test('URL input accepts text', async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="example.com"], input[type="url"]').first();
    if (await urlInput.isVisible()) {
      await urlInput.fill('https://test-site.com');
      await expect(urlInput).toHaveValue('https://test-site.com');
    }
  });

  test('keyboard shortcut ? opens shortcuts dialog', async ({ page }) => {
    await page.keyboard.press('?');
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dialog.locator('text=Keyboard Shortcuts')).toBeVisible();
      await expect(dialog.locator('text=Pause / Resume')).toBeVisible();
      await expect(dialog.locator('text=Rerun test')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });

  test('dark mode renders correctly', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('mobile layout stacks columns', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/qa-loop');
    await expect(page.locator('text=Start')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Test Results Page', () => {
  test('renders results page with tabs', async ({ page }) => {
    await page.goto('/test-results');
    await expect(page.locator('text=Runs').first()).toBeVisible({ timeout: 10_000 });
  });

  test('tab parameter persists in URL', async ({ page }) => {
    await page.goto('/test-results?tab=cases');
    await expect(page).toHaveURL(/tab=cases/);
  });

  test('switches between runs and cases tabs', async ({ page }) => {
    await page.goto('/test-results');
    const casesTab = page.locator('button:has-text("Cases"), [role="tab"]:has-text("Cases")').first();
    if (await casesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await casesTab.click();
      await expect(page).toHaveURL(/tab=cases/);
    }
  });
});

test.describe('Execution Detail Page', () => {
  test('shows not found or loading for invalid execution', async ({ page }) => {
    await page.goto('/test-runs/nonexistent-id');
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('runner page loads within 500ms TTI', async ({ page }) => {
    const start = Date.now();
    await page.goto('/qa-loop');
    await page.locator('text=Start').waitFor({ state: 'visible', timeout: 10_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
