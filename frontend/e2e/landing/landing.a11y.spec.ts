import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const locales = ['en', 'ar', 'fr', 'de', 'es'] as const;

for (const locale of locales) {
  test(`a11y audit (${locale})`, async ({ page }) => {
    await page.goto(`/?lng=${locale}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical',
    );

    expect(
      critical,
      `Critical a11y violations found for locale "${locale}":\n${critical.map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`).join('\n')}`,
    ).toHaveLength(0);
  });
}
