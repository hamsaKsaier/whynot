import { test, expect } from '@playwright/test';
import {
  ReconMockServer,
  makeSampleScan,
  assertNoBannedVocabulary,
} from '../fixtures/recon-mock-executor';

test.describe.configure({ mode: 'serial' });

test.describe('Recon — cancel & resume', () => {
  let mock: ReconMockServer;

  test.beforeEach(async ({ page }) => {
    const runningScan = makeSampleScan({ id: 'scan-1' });
    mock = new ReconMockServer({
      flagEnabled: true,
      seedScans: [runningScan],
    });
    mock.startScan('scan-1');
    await mock.install(page);
  });

  test('cancel from detail page flips status to cancelled', async ({ page }) => {
    await page.goto('/recon/scan-1');
    await expect(page.getByTestId('breadcrumb-scan-id')).toBeVisible();

    await page.getByTestId('scan-actions-menu').click();
    await page.getByTestId('action-cancel').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('confirm-cancel').click();

    await expect(page.getByTestId('scan-status-badge-cancelled')).toBeVisible({
      timeout: 5000,
    });
    expect(mock.state.lastCancelId).toBe('scan-1');
  });

  test('resume succeeds only when URL matches exactly', async ({ page }) => {
    // Put the seeded scan into a state that allows resume.
    mock.state.scans[0].status = 'stuck';

    await page.goto('/recon/scan-1');

    // Open resume via the stuck-banner CTA (visible on stuck scans).
    await expect(page.getByTestId('stuck-banner')).toBeVisible();
    await page.getByTestId('stuck-resume-cta').click();

    const input = page.getByTestId('resume-url-input');
    await expect(input).toBeVisible();

    // Mismatch: clear and type a different host → expect in-form error.
    await input.fill('https://other.example.com');
    await page.getByTestId('confirm-resume').click();
    await expect(
      page.getByText(/URL must match the original target exactly/i),
    ).toBeVisible();

    // Correct the URL → succeeds.
    await input.fill('https://staging.example.com');
    await page.getByTestId('confirm-resume').click();

    // Dialog closes and the scan status is no longer "stuck".
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(mock.state.lastResumeRequest).toEqual({
      id: 'scan-1',
      target_url: 'https://staging.example.com',
    });
  });

  test('no banned vocabulary on cancel/resume dialogs', async ({ page }) => {
    mock.state.scans[0].status = 'stuck';
    await page.goto('/recon/scan-1');
    await page.getByTestId('stuck-resume-cta').click();
    await assertNoBannedVocabulary(page);
  });
});
