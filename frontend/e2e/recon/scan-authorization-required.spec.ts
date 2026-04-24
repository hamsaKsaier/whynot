import { test, expect } from '@playwright/test';
import {
  ReconMockServer,
  assertNoBannedVocabulary,
} from '../fixtures/recon-mock-executor';

test.describe.configure({ mode: 'serial' });

test.describe('Recon — authorization is required', () => {
  test.beforeEach(async ({ page }) => {
    const mock = new ReconMockServer({ flagEnabled: true });
    await mock.install(page);
    await page.goto('/recon/new');
    // Complete step 1 so we can land on step 2.
    await page.getByTestId('wizard-project-select').click();
    await page.getByRole('option', { name: /acme api/i }).click();
    await page.getByTestId('wizard-environment-select').click();
    await page.getByRole('option', { name: /staging/i }).click();
    await page.getByTestId('wizard-step1-continue').click();
    await expect(page.getByTestId('wizard-step-2')).toBeVisible();
  });

  test('Continue is disabled without acknowledgement or justification', async ({
    page,
  }) => {
    const cont = page.getByTestId('wizard-step2-continue');
    await expect(cont).toBeDisabled();

    // Toggle switch only → still disabled because justification is empty.
    await page.getByTestId('wizard-ack-switch').click();
    await expect(cont).toBeDisabled();

    // Short (19 chars) justification → still disabled.
    await page
      .getByTestId('wizard-justification-input')
      .fill('too short to submit');
    await expect(cont).toBeDisabled();
    await expect(page.getByTestId('wizard-justification-input')).toHaveValue(
      'too short to submit',
    );

    // Fill to meet the 20-char minimum → becomes enabled.
    await page
      .getByTestId('wizard-justification-input')
      .fill('Pentest ticket SEC-1234 — authorized by Security lead.');
    await expect(cont).toBeEnabled();
  });

  test('toggling acknowledgement off after short justification still blocks progress', async ({
    page,
  }) => {
    await page.getByTestId('wizard-ack-switch').click();
    await page
      .getByTestId('wizard-justification-input')
      .fill('Pentest ticket SEC-1234 — authorized by Security lead.');
    await expect(page.getByTestId('wizard-step2-continue')).toBeEnabled();
    await page.getByTestId('wizard-ack-switch').click();
    await expect(page.getByTestId('wizard-step2-continue')).toBeDisabled();
  });

  test('no banned vocabulary on wizard step 2', async ({ page }) => {
    await assertNoBannedVocabulary(page);
  });
});
