import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { assertNoBannedVocabulary } from '../fixtures/recon-mock-executor';

test.describe('Landing Pricing Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('renders 3 plan cards', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText('Free')).toBeVisible();
    await expect(section.getByText('Pro (BYO Keys)')).toBeVisible();
    await expect(section.getByText('Pro (Managed)')).toBeVisible();
  });

  test('monthly/annual toggle round-trip', async ({ page }) => {
    const section = page.locator('#pricing');
    const monthlyPrice = await section.getByText('$29').textContent();
    expect(monthlyPrice).toBeTruthy();

    const annualTab = section.getByRole('tab', { name: /annual/i });
    await annualTab.click();
    await page.waitForTimeout(300);

    await expect(section.getByText('$23.2')).toBeVisible();

    const monthlyTab = section.getByRole('tab', { name: /monthly/i });
    await monthlyTab.click();
    await page.waitForTimeout(300);

    await expect(section.getByText('$29')).toBeVisible();
  });

  test('CTA links navigate to correct signup with plan query param', async ({ page }) => {
    const section = page.locator('#pricing');

    const freeLink = section.getByRole('link', { name: /start free/i });
    await expect(freeLink).toHaveAttribute('href', '/signup');

    const proLink = section.getByRole('link', { name: /get started/i });
    await expect(proLink).toHaveAttribute('href', '/signup?plan=pro_byo');

    const contactLink = section.getByRole('link', { name: /contact sales/i });
    await expect(contactLink).toHaveAttribute('href', '/contact');
  });

  test('popular badge visible on Pro BYO', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText('Most popular')).toBeVisible();
  });

  test('save badge visible on annual tab', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText(/Save 20%/)).toBeVisible();
  });

  test('a11y: zero critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#pricing')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test.describe('Recon row', () => {
    test('Recon row visible at desktop width', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/?lng=en', { waitUntil: 'networkidle' });
      await page.locator('#pricing').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('recon-row-free')).toBeVisible();
      await expect(page.getByTestId('recon-row-pro_byo')).toBeVisible();
      await expect(page.getByTestId('recon-row-pro_managed')).toBeVisible();
      await expect(page.getByTestId('recon-row-pro_byo')).toContainText(
        '1 included scan/month',
      );
    });

    test('Recon row visible at tablet width', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/?lng=en', { waitUntil: 'networkidle' });
      await page.locator('#pricing').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('recon-row-pro_byo')).toBeVisible();
    });

    test('Recon row visible at mobile width', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/?lng=en', { waitUntil: 'networkidle' });
      await page.locator('#pricing').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('recon-row-pro_byo')).toBeVisible();
    });

    test('Recon cell links to /docs/recon/quotas', async ({ page }) => {
      const row = page.getByTestId('recon-row-pro_byo');
      const link = row.locator('a');
      await expect(link).toHaveAttribute('href', '/docs/recon/quotas');
    });

    test('PAYG recon tooltip opens on hover', async ({ page }) => {
      await page.goto('/?lng=en', { waitUntil: 'networkidle' });
      const reconRow = page.getByTestId('recon-payg-row');
      await reconRow.scrollIntoViewIfNeeded();
      await expect(reconRow).toBeVisible();
      const trigger = page.getByTestId('recon-payg-tooltip-trigger');
      await trigger.hover();
      await expect(
        page.getByText(/Partial or cancelled scans are billed only/),
      ).toBeVisible();
    });

    test('pricing section contains no banned vocabulary', async ({ page }) => {
      await assertNoBannedVocabulary(page, '#pricing');
    });
  });

  test.describe('visual regression', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const dir of [
        { lng: 'en', label: 'ltr' },
        { lng: 'ar', label: 'rtl' },
      ] as const) {
        test(`pricing-${theme}-${dir.label}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/?lng=${dir.lng}`, { waitUntil: 'networkidle' });
          await page.locator('#pricing').scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);

          await expect(page.locator('#pricing')).toHaveScreenshot(
            `pricing-${theme}-${dir.label}.png`,
            { maxDiffPixelRatio: 0.01 },
          );
        });
      }
    }
  });
});
