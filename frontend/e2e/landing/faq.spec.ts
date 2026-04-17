import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Landing FAQ Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#faq').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('renders all 5 FAQ questions', async ({ page }) => {
    const section = page.locator('#faq');
    await expect(section.getByText('How does WhyNot find bugs automatically?')).toBeVisible();
    await expect(section.getByText('How do I integrate WhyNot with my app?')).toBeVisible();
    await expect(section.getByText('Is there a free tier?')).toBeVisible();
    await expect(section.getByText('Is my application data secure?')).toBeVisible();
    await expect(section.getByText('How accurate is the bug detection?')).toBeVisible();
  });

  test('renders heading and subheading', async ({ page }) => {
    const section = page.locator('#faq');
    await expect(section.getByText('Frequently asked questions')).toBeVisible();
    await expect(section.getByText('Everything you need to know about WhyNot.')).toBeVisible();
  });

  test('click Q1 → expand → answer visible', async ({ page }) => {
    const trigger = page.getByText('How does WhyNot find bugs automatically?');
    await trigger.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/WhyNot deploys autonomous AI agents/)).toBeVisible();
  });

  test('click Q1 → expand → URL hash updates', async ({ page }) => {
    const trigger = page.getByText('How does WhyNot find bugs automatically?');
    await trigger.click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('#faq-howItWorks');
  });

  test('click Q1 twice → collapses → answer hidden', async ({ page }) => {
    const trigger = page.getByText('How does WhyNot find bugs automatically?');
    await trigger.click();
    await page.waitForTimeout(300);
    await trigger.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/WhyNot deploys autonomous AI agents/)).not.toBeVisible();
  });

  test('only one item open at a time', async ({ page }) => {
    const q1 = page.getByText('How does WhyNot find bugs automatically?');
    const q2 = page.getByText('How do I integrate WhyNot with my app?');

    await q1.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/WhyNot deploys autonomous AI agents/)).toBeVisible();

    await q2.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/Just provide your app's URL/)).toBeVisible();
    await expect(page.getByText(/WhyNot deploys autonomous AI agents/)).not.toBeVisible();
  });

  test('chevron rotates on expand', async ({ page }) => {
    const trigger = page.getByText('How does WhyNot find bugs automatically?');
    const button = trigger.locator('..');
    const chevron = button.locator('svg');

    await trigger.click();
    await page.waitForTimeout(300);

    const classes = await chevron.getAttribute('class');
    expect(classes).toContain('rotate-180');
  });

  test('renders contact link', async ({ page }) => {
    const section = page.locator('#faq');
    await expect(section.getByText('Still have questions?')).toBeVisible();
    const contactLink = section.getByText('Contact us');
    await expect(contactLink).toBeVisible();
    await expect(contactLink.locator('..')).toHaveAttribute('href', 'mailto:support@whynot.sh');
  });

  test('a11y: zero critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#faq')
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('FAQ Deep-linking', () => {
  test('navigate to /#faq-security → security Q is open and in view', async ({ page }) => {
    await page.goto('/?lng=en#faq-security', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(/WhyNot runs tests in isolated browser sandboxes/),
    ).toBeVisible();

    const item = page.locator('#faq-security');
    await expect(item).toBeInViewport();
  });

  test('navigate to /#faq-pricing → pricing Q is open', async ({ page }) => {
    await page.goto('/?lng=en#faq-pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await expect(page.getByText(/free tier includes 50 test runs/)).toBeVisible();
    expect(page.url()).toContain('#faq-pricing');
  });

  test('hash change from outside opens matching item', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.location.hash = '#faq-accuracy';
    });
    await page.waitForTimeout(500);

    await expect(
      page.getByText(/99.2% accuracy rate/),
    ).toBeVisible();
  });
});

test.describe('FAQ RTL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.locator('#faq').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('deep-link works in Arabic locale', async ({ page }) => {
    await page.goto('/?lng=ar#faq-security', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const item = page.locator('#faq-security');
    await expect(item).toBeVisible();
  });

  test('expand/collapse works in RTL', async ({ page }) => {
    const triggers = page.locator('#faq button');
    await triggers.first().click();
    await page.waitForTimeout(300);

    const regionContent = page.locator('#faq [role="region"]').first();
    await expect(regionContent).toBeVisible();
  });
});
