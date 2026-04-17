import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { StructuredData } from '../StructuredData';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'landing'];
const FAQ_COUNT = 5;

const resources: Record<string, Record<string, unknown>> = {};
for (const lang of LANGUAGES) {
  resources[lang] = {};
  for (const ns of NAMESPACES) {
    resources[lang][ns] = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, lang, `${ns}.json`), 'utf-8'),
    );
  }
}

const testI18n = i18next.createInstance();
testI18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
});

afterEach(async () => {
  cleanup();
  await testI18n.changeLanguage('en');
});

function renderStructuredData() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <StructuredData />
    </I18nextProvider>,
  );
}

function getJsonLdScripts(): unknown[] {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || '{}'));
}

function findByType(schemas: unknown[], type: string): Record<string, unknown> | undefined {
  return schemas.find((s: any) => s['@type'] === type) as Record<string, unknown> | undefined;
}

describe('StructuredData', () => {
  it('produces valid JSON for all schemas', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    expect(schemas.length).toBe(4);
    for (const schema of schemas) {
      expect(schema).toBeTruthy();
      expect(typeof schema).toBe('object');
    }
  });

  it('Organization schema has required fields', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const org = findByType(schemas, 'Organization');
    expect(org).toBeTruthy();
    expect(org!['@context']).toBe('https://schema.org');
    expect(org!.name).toBe('WhyNot');
    expect(org!.url).toBe('https://whynot.sh');
    expect(org!.logo).toBeTruthy();
    expect(Array.isArray(org!.sameAs)).toBe(true);
    expect((org!.sameAs as string[]).length).toBe(2);
  });

  it('Organization.sameAs contains GitHub and X', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const org = findByType(schemas, 'Organization');
    const sameAs = org!.sameAs as string[];
    expect(sameAs.some((url) => url.includes('github.com'))).toBe(true);
    expect(sameAs.some((url) => url.includes('x.com'))).toBe(true);
  });

  it('Product schema has offers', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const product = findByType(schemas, 'Product');
    expect(product).toBeTruthy();
    expect(product!.name).toBe('WhyNot');
    expect(Array.isArray(product!.offers)).toBe(true);
    expect((product!.offers as unknown[]).length).toBe(3);
  });

  it('WebSite schema has required fields', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const webSite = findByType(schemas, 'WebSite');
    expect(webSite).toBeTruthy();
    expect(webSite!.name).toBe('WhyNot');
    expect(webSite!.url).toBe('https://whynot.sh');
  });

  it('FAQPage.mainEntity length matches FAQ items count', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const faq = findByType(schemas, 'FAQPage');
    expect(faq).toBeTruthy();
    const mainEntity = faq!.mainEntity as unknown[];
    expect(mainEntity.length).toBe(FAQ_COUNT);
  });

  it('FAQ items have Question type with accepted answers', () => {
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const faq = findByType(schemas, 'FAQPage');
    const mainEntity = faq!.mainEntity as Array<Record<string, unknown>>;
    for (const item of mainEntity) {
      expect(item['@type']).toBe('Question');
      expect(item.name).toBeTruthy();
      const answer = item.acceptedAnswer as Record<string, unknown>;
      expect(answer['@type']).toBe('Answer');
      expect(answer.text).toBeTruthy();
    }
  });

  for (const lang of LANGUAGES) {
    it(`Organization.name is translated for ${lang}`, async () => {
      await act(async () => {
        await testI18n.changeLanguage(lang);
      });
      renderStructuredData();
      const schemas = getJsonLdScripts();
      const org = findByType(schemas, 'Organization');
      expect(org!.name).toBe('WhyNot');
      expect(org!.description).toBeTruthy();
      if (lang === 'ar') {
        expect(org!.description as string).toMatch(/[\u0600-\u06FF]/);
      }
    });
  }

  it('FAQPage questions are translated per locale (Arabic)', async () => {
    await act(async () => {
      await testI18n.changeLanguage('ar');
    });
    renderStructuredData();
    const schemas = getJsonLdScripts();
    const faq = findByType(schemas, 'FAQPage');
    const mainEntity = faq!.mainEntity as Array<Record<string, unknown>>;
    for (const item of mainEntity) {
      expect(item.name as string).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
