import { test, expect } from '@playwright/test';

// TODO: landing page is rebuilt in phase 9 — unskip after prompt 49.
test.skip('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/whynot/i);
});
