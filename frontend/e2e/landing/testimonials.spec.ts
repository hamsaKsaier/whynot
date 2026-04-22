import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Landing Testimonials Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#testimonials').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('renders heading and subheading', async ({ page }) => {
    const section = page.locator('#testimonials');
    await expect(section.getByText('Loved by engineering teams')).toBeVisible();
    await expect(section.getByText(/See how teams use WhyNot/)).toBeVisible();
  });

  test('renders all 3 testimonial authors', async ({ page }) => {
    const section = page.locator('#testimonials');
    await expect(section.getByText('Sarah Chen')).toBeVisible();
    await expect(section.getByText('Marcus Johnson')).toBeVisible();
    await expect(section.getByText('Elena Rodriguez')).toBeVisible();
  });

  test('renders company names', async ({ page }) => {
    const section = page.locator('#testimonials');
    await expect(section.getByText('ShopFlow')).toBeVisible();
    await expect(section.getByText('LaunchPad AI')).toBeVisible();
    await expect(section.getByText('Meridian Health')).toBeVisible();
  });

  test('uses blockquote elements for quotes', async ({ page }) => {
    const blockquotes = page.locator('#testimonials blockquote');
    await expect(blockquotes).toHaveCount(3);
  });

  test('uses cite elements for attribution', async ({ page }) => {
    const cites = page.locator('#testimonials cite');
    await expect(cites).toHaveCount(3);
  });

  test('carousel has correct ARIA attributes', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await expect(carousel).toBeVisible();
    await expect(carousel).toHaveAttribute('role', 'region');
  });

  test('dot indicators have tablist/tab roles', async ({ page }) => {
    const tablist = page.locator('#testimonials [role="tablist"]');
    await expect(tablist).toBeVisible();
    const tabs = page.locator('#testimonials [role="tab"]');
    await expect(tabs).toHaveCount(3);
  });

  test('a11y: zero critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('#testimonials')
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('Testimonials Mobile Carousel', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.locator('#testimonials').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('drag gesture advances carousel', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    const box = await carousel.boundingBox();
    if (!box) return;

    const startX = box.x + box.width * 0.8;
    const endX = box.x + box.width * 0.2;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    const secondDot = page.locator('#testimonials [role="tab"]').nth(1);
    await expect(secondDot).toHaveAttribute('aria-selected', 'true');
  });

  test('keyboard arrows navigate slides', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await carousel.focus();

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const secondDot = page.locator('#testimonials [role="tab"]').nth(1);
    await expect(secondDot).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const firstDot = page.locator('#testimonials [role="tab"]').nth(0);
    await expect(firstDot).toHaveAttribute('aria-selected', 'true');
  });

  test('autoplay advances after 6 seconds', async ({ page }) => {
    const firstDot = page.locator('#testimonials [role="tab"]').nth(0);
    await expect(firstDot).toHaveAttribute('aria-selected', 'true');

    await page.waitForTimeout(6500);
    const secondDot = page.locator('#testimonials [role="tab"]').nth(1);
    await expect(secondDot).toHaveAttribute('aria-selected', 'true');
  });

  test('autoplay pauses on hover', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await carousel.hover();

    await page.waitForTimeout(7000);
    const firstDot = page.locator('#testimonials [role="tab"]').nth(0);
    await expect(firstDot).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Testimonials RTL', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.locator('#testimonials').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  test('ArrowLeft advances to next in RTL', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await carousel.focus();

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const secondDot = page.locator('#testimonials [role="tab"]').nth(1);
    await expect(secondDot).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowRight goes to previous in RTL', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await carousel.focus();

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const firstDot = page.locator('#testimonials [role="tab"]').nth(0);
    await expect(firstDot).toHaveAttribute('aria-selected', 'true');
  });
});
