import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BREAKPOINTS = [
  { width: 360, height: 640, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1024, height: 768, label: 'laptop' },
  { width: 1440, height: 900, label: 'desktop' },
];

const BANNED_VOCABULARY = [
  'Shannon',
  'KeygraphHQ',
  'nmap',
  'subfinder',
  'whatweb',
  'schemathesis',
  'Playwright',
  'Anthropic',
  'Claude',
];

test.describe('Landing Recon Feature Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#recon').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('renders heading and 3 benefit cards', async ({ page }) => {
    const section = page.locator('#recon');
    await expect(
      section.getByRole('heading', { name: 'Pentest every release. Not once a year.' }),
    ).toBeVisible();
    await expect(section.getByText('Proof, not theory')).toBeVisible();
    await expect(section.getByText('Source-aware')).toBeVisible();
    await expect(section.getByText('On-demand')).toBeVisible();
  });

  for (const bp of BREAKPOINTS) {
    test(`section visible at ${bp.label} (${bp.width}x${bp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      const section = page.locator('#recon');
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      await expect(section.getByText('Proof, not theory')).toBeVisible();
    });
  }

  test('primary CTA navigates to /signup?ref=recon for unauthenticated user', async ({ page }) => {
    const section = page.locator('#recon');
    await section.getByRole('button', { name: /Try Recon/i }).click();
    await page.waitForURL(/\/signup\?ref=recon/);
    expect(page.url()).toContain('/signup?ref=recon');
  });

  test('sample-report modal opens and closes', async ({ page }) => {
    const section = page.locator('#recon');
    await section.getByRole('button', { name: /See a sample report/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Sample finding/)).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('axe-core: zero critical violations (en)', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#recon')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('axe-core: zero critical violations (ar)', async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.locator('#recon').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .include('#recon')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('no banned vocabulary in rendered section', async ({ page }) => {
    const sectionHtml = await page.locator('#recon').innerHTML();
    for (const term of BANNED_VOCABULARY) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      expect(sectionHtml, `banned term "${term}" should not appear`).not.toMatch(regex);
    }
  });

  test.describe('visual regression', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const { lng, label } of [
        { lng: 'en', label: 'ltr' },
        { lng: 'ar', label: 'rtl' },
      ] as const) {
        test(`recon-${theme}-${label}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/?lng=${lng}`, { waitUntil: 'networkidle' });
          await page.locator('#recon').scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
          await expect(page.locator('#recon')).toHaveScreenshot(
            `recon-${theme}-${label}.png`,
            { maxDiffPixelRatio: 0.01 },
          );
        });
      }
    }
  });
});
