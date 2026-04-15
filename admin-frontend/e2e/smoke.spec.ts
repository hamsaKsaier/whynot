import { test, expect } from '@playwright/test';

// TODO: admin frontend is rebuilt in phase 7 — unskip after prompt 42.
test.skip('admin page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/whynot/i);
});
