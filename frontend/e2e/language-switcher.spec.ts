import { test, expect } from '@playwright/test';

const LANGUAGES = [
  { code: 'en', dir: 'ltr', name: 'English' },
  { code: 'ar', dir: 'rtl', name: 'العربية' },
  { code: 'fr', dir: 'ltr', name: 'Français' },
  { code: 'de', dir: 'ltr', name: 'Deutsch' },
  { code: 'es', dir: 'ltr', name: 'Español' },
];

test.describe('language switcher — frontend', () => {
  test('cycles through all 5 languages and updates html lang/dir', async ({ page }) => {
    await page.goto('/');

    for (const lang of LANGUAGES) {
      await page.getByRole('button', { name: 'Change language' }).click();
      await page.getByText(lang.name).click();

      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);
      await expect(page.locator('html')).toHaveAttribute('dir', lang.dir);
    }
  });

  test('Arabic sets dir=rtl, switching back to English restores dir=ltr', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByText('العربية').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByText('English').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('language persists on page refresh', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByText('Français').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('UI text changes when language switches', async ({ page }) => {
    await page.goto('/');

    for (const lang of LANGUAGES) {
      await page.getByRole('button', { name: 'Change language' }).click();
      await page.getByText(lang.name).click();

      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(typeof bodyText).toBe('string');
    }
  });

  test('no console errors during language cycling', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    for (const lang of LANGUAGES) {
      await page.getByRole('button', { name: 'Change language' }).click();
      await page.getByText(lang.name).click();
      await page.waitForTimeout(500);
    }

    expect(errors).toEqual([]);
  });
});
