import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

function loadJson(lang: string, ns: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, `${ns}.json`), 'utf-8'));
}

let currentLang = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const translations = loadJson(currentLang, 'runner');
    const t = (key: string, opts?: Record<string, any>) => {
      let value = translations[key] ?? key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return value;
    };
    return { t, i18n: { language: currentLang } };
  },
}));

vi.mock('react-icons/fi', () => ({
  FiPlus: () => <span data-testid="icon-plus" />,
  FiTrash2: () => <span data-testid="icon-trash" />,
  FiPlay: () => <span data-testid="icon-play" />,
  FiSave: () => <span data-testid="icon-save" />,
  FiBookmark: () => <span data-testid="icon-bookmark" />,
}));

vi.mock('../../../services/perf-api', () => ({}));

import { TestConfig } from '../TestConfig';

const TEST_TYPES = ['smoke', 'load', 'stress', 'spike'] as const;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

describe('TestConfig i18n compliance', () => {
  beforeEach(() => {
    currentLang = 'en';
  });

  describe.each(LANGUAGES)('locale: %s', (lang) => {
    let translations: Record<string, string>;

    beforeEach(() => {
      currentLang = lang;
      translations = loadJson(lang, 'runner');
    });

    it('renders translated test type button labels', () => {
      render(<TestConfig onRun={vi.fn()} isRunning={false} />);

      for (const type of TEST_TYPES) {
        const key = `runner.performance.testType.${type}`;
        const expected = translations[key];
        expect(expected).toBeDefined();
        expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
      }
    });

    it('shows translated description for the default test type (load)', () => {
      render(<TestConfig onRun={vi.fn()} isRunning={false} />);

      const key = 'runner.performance.testTypeDescription.load';
      const expected = translations[key];
      expect(expected).toBeDefined();
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('renders translated HTTP method options in the select', () => {
      render(<TestConfig onRun={vi.fn()} isRunning={false} />);

      // Find the method select by looking for the select element that contains GET/POST etc.
      const selects = screen.getAllByRole('combobox');
      // The method select is the one with 5 HTTP method options
      const methodSelect = selects.find((select) => {
        const options = within(select).getAllByRole('option');
        return options.length === 5;
      });
      expect(methodSelect).toBeDefined();

      const options = within(methodSelect!).getAllByRole('option');
      expect(options).toHaveLength(5);

      for (const method of HTTP_METHODS) {
        const key = `runner.performance.httpMethod.${method}`;
        const expected = translations[key];
        expect(expected).toBeDefined();

        const matchingOption = options.find(
          (opt) => opt.textContent === expected
        );
        expect(matchingOption).toBeDefined();
      }
    });
  });

  it('falls back to raw key when a translation key is missing', () => {
    // Create a modified translations set with the smoke key removed
    const originalReadFileSync = fs.readFileSync;
    const missingKeyLang = 'en';
    currentLang = missingKeyLang;

    const spoofReadFileSync = vi.fn((...args: any[]) => {
      const result = (originalReadFileSync as any)(...args);
      // Only intercept runner.json reads
      if (typeof args[0] === 'string' && args[0].endsWith('runner.json')) {
        const parsed = JSON.parse(result as string);
        delete parsed['runner.performance.testType.smoke'];
        return JSON.stringify(parsed);
      }
      return result;
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation(spoofReadFileSync);

    try {
      render(<TestConfig onRun={vi.fn()} isRunning={false} />);

      // When the key is missing, the raw key should be rendered as fallback
      expect(
        screen.getByRole('button', { name: 'runner.performance.testType.smoke' })
      ).toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
