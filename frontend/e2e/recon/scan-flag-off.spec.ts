import { test, expect } from '@playwright/test';
import {
  ReconMockServer,
  assertNoBannedVocabulary,
} from '../fixtures/recon-mock-executor';

test.describe.configure({ mode: 'serial' });

test.describe('Recon — feature flag off', () => {
  test.beforeEach(async ({ page }) => {
    const mock = new ReconMockServer({ flagEnabled: false });
    await mock.install(page);
  });

  test('sidebar entry is not rendered when recon_enabled is false', async ({
    page,
  }) => {
    await page.goto('/app');
    await expect(page.getByTestId('sidebar-nav-recon')).toHaveCount(0);
  });

  test('navigating to /recon renders the 404 page, not a "feature disabled" message', async ({
    page,
  }) => {
    await page.goto('/recon');
    // NotFoundPage — shared with other unknown routes. Rule 7/9: we show the
    // standard 404, not a dedicated "feature disabled" hint.
    await expect(
      page.getByRole('heading', { name: /not found|404/i }),
    ).toBeVisible();

    // The Recon list's title should not be present.
    await expect(page.getByText('Authorized security scans')).toHaveCount(0);

    await assertNoBannedVocabulary(page);
  });

  test('navigating to /recon/new and /recon/:id also render 404', async ({
    page,
  }) => {
    await page.goto('/recon/new');
    await expect(
      page.getByRole('heading', { name: /not found|404/i }),
    ).toBeVisible();
    await expect(page.getByTestId('wizard-step-1')).toHaveCount(0);

    await page.goto('/recon/some-id');
    await expect(
      page.getByRole('heading', { name: /not found|404/i }),
    ).toBeVisible();
  });
});
