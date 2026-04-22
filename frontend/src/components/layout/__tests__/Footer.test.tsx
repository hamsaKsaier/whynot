import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Translation loader
// ---------------------------------------------------------------------------

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, string> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Mutable language used by the mock
// ---------------------------------------------------------------------------

let currentLang = 'en';

// ---------------------------------------------------------------------------
// Mock react-i18next
// ---------------------------------------------------------------------------

const mockUseTranslation = () => {
  const translations = loadJson(currentLang, 'common');
  const t = (key: string, opts?: Record<string, unknown>) => {
    let value = translations[key] ?? key;
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return { t, i18n: { language: currentLang } };
};

vi.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslation(),
}));

// ---------------------------------------------------------------------------
// Mock @/config
// ---------------------------------------------------------------------------

vi.mock('@/config', () => ({
  config: { appVersion: '1.2.3' },
}));

// ---------------------------------------------------------------------------
// Mock @/components/ui/separator
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import { Footer } from '../Footer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

function interpolate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Footer i18n', () => {
  for (const lang of LANGUAGES) {
    describe(`locale: ${lang}`, () => {
      let translations: Record<string, string>;

      beforeEach(() => {
        currentLang = lang;
        translations = loadJson(lang, 'common');
      });

      it('renders translated "Docs" link', () => {
        render(<Footer />);
        expect(screen.getByText(translations['common.footer.docs'])).toBeInTheDocument();
      });

      it('renders translated "Status" link', () => {
        render(<Footer />);
        expect(screen.getByText(translations['common.footer.status'])).toBeInTheDocument();
      });

      it('renders translated version text with interpolated version', () => {
        render(<Footer />);
        const expectedVersion = interpolate(
          translations['common.footer.appVersion'],
          { version: '1.2.3' },
        );
        expect(screen.getByText(expectedVersion)).toBeInTheDocument();
      });
    });
  }
});
