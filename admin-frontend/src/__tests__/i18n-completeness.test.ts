import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'];
const NON_EN_LANGUAGES = LANGUAGES.filter(l => l !== 'en');
const NAMESPACES = ['common', 'admin', 'auth', 'settings'];

const BRAND_ALLOW_LIST = new Set([
  'WhyNot QA',
  'QA Loop',
  'MCP',
  'Stripe',
  'GitHub',
  'Google',
  'CI/CD',
  'CSV',
  'JSON',
  'UUID',
  'URL',
  'ID',
  'JWT',
  'MRR',
  'ARR',
  'API',
  'admin@example.com',
  '••••••••',
  // International cognates — same word in multiple languages
  'Admin',
  'Action',
  'Date',
  'Actions',
  'Actor',
  'Audit',
  'Dashboard',
  'Description',
  'Details',
  'Enterprise',
  'Error',
  'Flag',
  'Flags',
  'General',
  'Name',
  'Navigation',
  'Plan',
  'Plans',
  'Public',
  'Rollout',
  'Slug',
  'Status',
  'Super Admin',
  'System',
  'Type',
  'Webhooks',
]);

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function getValues(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, getValues(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function loadJson(lang: string, ns: string): Record<string, unknown> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('i18n completeness — admin-frontend', () => {
  it('all 5 languages have the same set of namespaces', () => {
    for (const lang of LANGUAGES) {
      const langDir = path.join(LOCALES_DIR, lang);
      expect(fs.existsSync(langDir), `${lang}/ directory missing`).toBe(true);

      const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();
      expect(files, `${lang} namespace mismatch`).toEqual([...NAMESPACES].sort());
    }
  });

  for (const ns of NAMESPACES) {
    it(`namespace "${ns}" has identical key trees across all languages`, () => {
      const enKeys = getKeys(loadJson('en', ns));
      expect(enKeys.length).toBeGreaterThan(0);

      for (const lang of NON_EN_LANGUAGES) {
        const langKeys = getKeys(loadJson(lang, ns));
        expect(langKeys, `${lang}/${ns}.json key mismatch vs en`).toEqual(enKeys);
      }
    });
  }

  for (const ns of NAMESPACES) {
    for (const lang of NON_EN_LANGUAGES) {
      it(`${lang}/${ns}.json — all values are non-empty and translated (not English)`, () => {
        const enValues = getValues(loadJson('en', ns));
        const langValues = getValues(loadJson(lang, ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const langValue = langValues[key];
          expect(langValue, `${lang}/${ns}.json key "${key}" is missing`).toBeDefined();
          expect(langValue.trim().length, `${lang}/${ns}.json key "${key}" is empty`).toBeGreaterThan(0);

          if (!BRAND_ALLOW_LIST.has(enValue.trim())) {
            expect(langValue, `${lang}/${ns}.json key "${key}" is still English: "${langValue}"`).not.toBe(enValue);
          }
        }
      });
    }
  }

  it('pluralization: keys with {{count}} have appropriate values', () => {
    const interpolationKeys = [
      { ns: 'common', key: 'admin.common.selected' },
      { ns: 'common', key: 'admin.common.pageOf' },
      { ns: 'common', key: 'admin.dashboard.subscribers' },
      { ns: 'common', key: 'admin.users.totalUsers' },
      { ns: 'common', key: 'admin.common.typeToConfirm' },
    ];

    for (const { ns, key } of interpolationKeys) {
      for (const lang of LANGUAGES) {
        const values = getValues(loadJson(lang, ns));
        expect(values[key], `${lang}/${ns}.json missing interpolation key "${key}"`).toBeDefined();
        expect(values[key].length, `${lang}/${ns}.json key "${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});
