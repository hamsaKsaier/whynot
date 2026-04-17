import { test, expect } from '@playwright/test';

test.describe('Email Capture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    // Scroll to CTA section where EmailCapture lives
    await page.evaluate(() => {
      const ctaSection = document.querySelector('section.bg-muted');
      ctaSection?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(500);
  });

  test('shows validation error for invalid email', async ({ page }) => {
    const input = page.locator('input[type="email"]').first();
    await input.fill('not-valid');
    await input.blur();
    await page.waitForTimeout(200);

    const error = page.getByText('Please enter a valid email address.');
    await expect(error).toBeVisible();
  });

  test('submit button is disabled for invalid email', async ({ page }) => {
    const input = page.locator('input[type="email"]').first();
    await input.fill('bad');

    const submitButton = input.locator('..').locator('..').locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('submit button is enabled for valid email', async ({ page }) => {
    const input = page.locator('input[type="email"]').first();
    await input.fill('test@example.com');

    const form = input.locator('xpath=ancestor::form');
    const submitButton = form.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  test('shows success state after valid submission', async ({ page }) => {
    await page.route('**/api/landing/leads', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    const input = page.locator('input[type="email"]').first();
    await input.fill('test@example.com');

    const form = input.locator('xpath=ancestor::form');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText("Thanks! We'll be in touch soon.")).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows rate-limited state on 429 response', async ({ page }) => {
    await page.route('**/api/landing/leads', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
    );

    const input = page.locator('input[type="email"]').first();
    await input.fill('test@example.com');

    const form = input.locator('xpath=ancestor::form');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(/try again in/i)).toBeVisible({ timeout: 5000 });
  });

  test('shows server error message', async ({ page }) => {
    await page.route('**/api/landing/leads', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal error' }),
      }),
    );

    const input = page.locator('input[type="email"]').first();
    await input.fill('test@example.com');

    const form = input.locator('xpath=ancestor::form');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('Internal error')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Email Capture - Accessibility', () => {
  test('email input has aria-label', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    const input = page.locator('input[type="email"]').first();
    await expect(input).toHaveAttribute('aria-label', 'Email address');
  });

  test('live region is present', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion.first()).toBeAttached();
  });
});
