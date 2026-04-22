import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fs from 'fs';
import path from 'path';
import { SEOHead } from '../SEOHead';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NAMESPACES = ['common', 'landing'];

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
  document.querySelectorAll('link[rel="alternate"]').forEach((el) => el.remove());
  document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  document.querySelectorAll('meta[property^="og:"]').forEach((el) => el.remove());
  document.querySelectorAll('meta[name^="twitter:"]').forEach((el) => el.remove());
  document.querySelectorAll('meta[name="description"]').forEach((el) => el.remove());
  document.querySelectorAll('meta[name="keywords"]').forEach((el) => el.remove());
  await testI18n.changeLanguage('en');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

function renderSEOHead(lang = 'en') {
  return render(
    <I18nextProvider i18n={testI18n}>
      <SEOHead />
    </I18nextProvider>,
  );
}

const EXPECTED_TITLES: Record<string, string> = {
  en: 'WhyNot — Autonomous AI-Powered QA Testing',
  ar: 'WhyNot — اختبار ضمان الجودة الذاتي بالذكاء الاصطناعي',
  fr: "WhyNot — Tests QA autonomes propulsés par l'IA",
  de: 'WhyNot — Autonomes KI-gestütztes QA-Testing',
  es: 'WhyNot — Pruebas QA autónomas con IA',
};

describe('SEOHead', () => {
  for (const lang of LANGUAGES) {
    describe(`locale: ${lang}`, () => {
      it('sets correct title', async () => {
        await act(async () => {
          await testI18n.changeLanguage(lang);
        });
        renderSEOHead(lang);
        expect(document.title).toBe(EXPECTED_TITLES[lang]);
      });

      it('sets meta description', async () => {
        await act(async () => {
          await testI18n.changeLanguage(lang);
        });
        renderSEOHead(lang);
        const desc = document.querySelector('meta[name="description"]');
        expect(desc).toBeTruthy();
        expect(desc?.getAttribute('content')).toBeTruthy();
        expect(desc?.getAttribute('content')?.length).toBeGreaterThan(10);
      });

      it('sets meta keywords', async () => {
        await act(async () => {
          await testI18n.changeLanguage(lang);
        });
        renderSEOHead(lang);
        const kw = document.querySelector('meta[name="keywords"]');
        expect(kw).toBeTruthy();
        expect(kw?.getAttribute('content')).toBeTruthy();
      });

      it('sets hreflang entries for all 5 locales + x-default', async () => {
        await act(async () => {
          await testI18n.changeLanguage(lang);
        });
        renderSEOHead(lang);
        const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
        expect(hreflangs.length).toBe(6); // 5 locales + x-default

        const hreflangValues = Array.from(hreflangs).map((el) => el.getAttribute('hreflang'));
        for (const l of LANGUAGES) {
          expect(hreflangValues).toContain(l);
        }
        expect(hreflangValues).toContain('x-default');
      });
    });
  }

  it('sets canonical link', () => {
    renderSEOHead();
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical).toBeTruthy();
    expect(canonical?.getAttribute('href')).toBe('https://whynot.sh');
  });

  it('sets twitter:site handle', () => {
    renderSEOHead();
    const twitterSite = document.querySelector('meta[name="twitter:site"]');
    expect(twitterSite).toBeTruthy();
    expect(twitterSite?.getAttribute('content')).toBe('@whynotqa');
  });

  it('sets twitter:card as summary_large_image', () => {
    renderSEOHead();
    const card = document.querySelector('meta[name="twitter:card"]');
    expect(card).toBeTruthy();
    expect(card?.getAttribute('content')).toBe('summary_large_image');
  });

  it('sets og:locale', () => {
    renderSEOHead();
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    expect(ogLocale).toBeTruthy();
    expect(ogLocale?.getAttribute('content')).toBe('en_US');
  });

  it('hreflang links use lng parameter', () => {
    renderSEOHead();
    const enLink = document.querySelector('link[hreflang="en"]');
    expect(enLink?.getAttribute('href')).toBe('https://whynot.sh/?lng=en');
  });

  it('x-default hreflang has no lng parameter', () => {
    renderSEOHead();
    const xDefault = document.querySelector('link[hreflang="x-default"]');
    expect(xDefault?.getAttribute('href')).toBe('https://whynot.sh');
  });

  it('og:url points to canonical URL', () => {
    renderSEOHead();
    const ogUrl = document.querySelector('meta[property="og:url"]');
    expect(ogUrl?.getAttribute('content')).toBe('https://whynot.sh');
  });

  it('og:image includes locale path', () => {
    renderSEOHead();
    const ogImage = document.querySelector('meta[property="og:image"]');
    expect(ogImage?.getAttribute('content')).toBe('https://whynot.sh/og/en.png');
  });

  it('cleanup removes hreflang links on unmount', () => {
    const { unmount } = renderSEOHead();
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]').length).toBe(6);
    unmount();
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]').length).toBe(0);
  });
});
