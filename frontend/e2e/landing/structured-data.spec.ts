import { test, expect } from '@playwright/test';

test.describe('Structured Data', () => {
  test('all JSON-LD scripts parse correctly and have required keys', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const schemas = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      return Array.from(scripts).map((s) => {
        try {
          return JSON.parse(s.textContent || '{}');
        } catch {
          return null;
        }
      });
    });

    expect(schemas.length).toBeGreaterThanOrEqual(4);
    for (const schema of schemas) {
      expect(schema).toBeTruthy();
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBeTruthy();
    }
  });

  test('Organization schema has sameAs with GitHub and X', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const org = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'Organization') return data;
      }
      return null;
    });

    expect(org).toBeTruthy();
    expect(org.name).toBe('WhyNot');
    expect(org.sameAs).toContain('https://github.com/whynot-dev');
    expect(org.sameAs).toContain('https://x.com/whynot_dev');
  });

  test('Product schema has 3 offers', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const product = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'Product') return data;
      }
      return null;
    });

    expect(product).toBeTruthy();
    expect(product.offers.length).toBe(3);
  });

  test('FAQPage has 5 questions', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const faq = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'FAQPage') return data;
      }
      return null;
    });

    expect(faq).toBeTruthy();
    expect(faq.mainEntity.length).toBe(5);
    for (const item of faq.mainEntity) {
      expect(item['@type']).toBe('Question');
      expect(item.name).toBeTruthy();
      expect(item.acceptedAnswer['@type']).toBe('Answer');
      expect(item.acceptedAnswer.text).toBeTruthy();
    }
  });

  test('structured data is translated for Arabic', async ({ page }) => {
    await page.goto('/?lng=ar', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const faq = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'FAQPage') return data;
      }
      return null;
    });

    expect(faq).toBeTruthy();
    for (const item of faq.mainEntity) {
      expect(item.name).toMatch(/[\u0600-\u06FF]/);
    }
  });

  test('WebSite schema has required fields', async ({ page }) => {
    await page.goto('/?lng=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const webSite = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'WebSite') return data;
      }
      return null;
    });

    expect(webSite).toBeTruthy();
    expect(webSite.name).toBe('WhyNot');
    expect(webSite.url).toBe('https://whynot.sh');
  });
});
