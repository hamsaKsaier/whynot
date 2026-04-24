import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  ReconMockServer,
  assertNoBannedVocabulary,
} from '../fixtures/recon-mock-executor';

// Stateful mocks share a single `mock` per-test; serial mode avoids leaks.
test.describe.configure({ mode: 'serial' });

test.describe('Recon — scan happy path', () => {
  let mock: ReconMockServer;

  test.beforeEach(async ({ page }) => {
    mock = new ReconMockServer({ flagEnabled: true });
    await mock.install(page);
  });

  test('wizard → detail page → findings + report render, no banned vocabulary, axe clean', async ({
    page,
  }) => {
    // Sidebar
    await page.goto('/recon');
    await expect(page.getByTestId('sidebar-nav-recon')).toBeVisible();

    // Empty list → click "New scan"
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toBeVisible();
    await page.getByRole('link', { name: /new scan|start a scan/i }).first().click();
    await page.waitForURL(/\/recon\/new/);

    // Step 1: project + environment
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();
    await page.getByTestId('wizard-project-select').click();
    await page.getByRole('option', { name: /acme api/i }).click();
    await page.getByTestId('wizard-environment-select').click();
    await page.getByRole('option', { name: /staging/i }).click();
    const continueBtn = page.getByTestId('wizard-step1-continue');
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Step 2: authorization switch + justification
    await expect(page.getByTestId('wizard-step-2')).toBeVisible();
    await page.getByTestId('wizard-ack-switch').click();
    await page
      .getByTestId('wizard-justification-input')
      .fill('Authorized by Security Team ticket #1234 — quarterly pentest.');
    await page.getByTestId('wizard-step2-continue').click();

    // Step 3: review + submit
    await expect(page.getByTestId('wizard-step-3')).toBeVisible();
    await expect(page.getByTestId('wizard-summary-project')).toContainText('Acme API');
    await expect(page.getByTestId('wizard-summary-environment')).toContainText('Staging');
    await expect(page.getByTestId('wizard-summary-url')).toContainText(
      'https://staging.example.com',
    );

    await page.getByTestId('wizard-step3-submit').click();

    // Lands on /recon/:scanId
    await page.waitForURL(/\/recon\/scan-\d+/);
    await expect(page.getByTestId('breadcrumb-scan-id')).toBeVisible();

    // Phase timeline visible, first phase running
    await page.getByTestId('tab-phases').click();
    await expect(page.getByTestId('phase-timeline')).toBeVisible();
    await expect(page.getByTestId('phase-fingerprinting')).toBeVisible();

    // Complete the scan (instant phase transitions via the mock) and refresh.
    const scanId = mock.state.scans[0].id;
    mock.completeScan(scanId);
    await page.reload();

    // Findings tab: at least one finding card, PoC toggle expands
    await page.getByTestId('tab-findings').click();
    const findingCard = page.getByTestId('finding-card-finding-1');
    await expect(findingCard).toBeVisible();
    await page.getByTestId('finding-poc-toggle-finding-1').click();
    await expect(
      findingCard.locator('[data-testid^="recon-poc-viewer-"]').first(),
    ).toBeVisible();

    // Report tab: markdown renders
    await page.getByTestId('tab-report').click();
    await expect(page.getByTestId('report-viewer')).toBeVisible();
    await expect(page.getByText(/One high-severity finding was confirmed/i)).toBeVisible();

    // Banned-vocabulary check on rendered page (excluding script tags)
    await assertNoBannedVocabulary(page);

    // axe-core: zero critical violations on the detail page
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = axe.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);

    // Authorization was sent to the server in the create request.
    expect(mock.state.lastCreateRequest).toMatchObject({
      project_id: 'proj-1',
      environment_id: 'env-1',
      target_url: 'https://staging.example.com',
      authorization: {
        acknowledged: true,
      },
    });
  });

  // Visual regression snapshots — one per configured project (LTR/RTL × light/dark).
  test('visual: wizard step 1', async ({ page }, testInfo) => {
    await page.goto('/recon/new');
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`wizard-step1-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});
