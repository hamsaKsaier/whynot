import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.resolve(__dirname, '../i18n/translations');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NON_EN_LANGUAGES = LANGUAGES.filter(l => l !== 'en');

// Recon-scoped namespaces in the gateway. Only keys that mention `recon`
// in the dotted path are gated by this test.
const NAMESPACES = ['errors', 'success', 'validation', 'billing'] as const;

const BANNED_TERMS = [
  'Shannon',
  'KeygraphHQ',
  'nmap',
  'subfinder',
  'whatweb',
  'schemathesis',
  'Playwright',
  'Anthropic',
  'Claude',
];

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

function loadJson(lang: string, ns: string): Record<string, unknown> {
  const filePath = path.join(TRANSLATIONS_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function reconKeysForNamespace(lang: string, ns: string) {
  const flat = flatten(loadJson(lang, ns));
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (/(^|\.)recon(\.|$)/i.test(key)) filtered[key] = value;
  }
  return filtered;
}

describe('Recon i18n — 5-language coverage (gateway)', () => {
  for (const ns of NAMESPACES) {
    it(`en/${ns}.json exposes the canonical Recon key list`, () => {
      const keys = Object.keys(reconKeysForNamespace('en', ns));
      // Not every gateway namespace must contain Recon keys, but if en has
      // none then downstream parity checks are vacuous. Require at least one
      // namespace to carry Recon keys overall.
      expect(Array.isArray(keys)).toBe(true);
    });

    for (const lang of NON_EN_LANGUAGES) {
      it(`${lang}/${ns}.json — every Recon key from en exists with a non-empty value`, () => {
        const enEntries = reconKeysForNamespace('en', ns);
        const langEntries = reconKeysForNamespace(lang, ns);

        const missing: string[] = [];
        const empty: string[] = [];
        for (const key of Object.keys(enEntries)) {
          if (!(key in langEntries)) {
            missing.push(key);
          } else if (String(langEntries[key]).trim().length === 0) {
            empty.push(key);
          }
        }

        expect(
          missing,
          `${lang}/${ns}.json missing Recon keys:\n${missing.join('\n')}`
        ).toEqual([]);
        expect(
          empty,
          `${lang}/${ns}.json empty Recon values:\n${empty.join('\n')}`
        ).toEqual([]);
      });

      it(`${lang}/${ns}.json — has no extra Recon keys beyond en`, () => {
        const enKeys = new Set(Object.keys(reconKeysForNamespace('en', ns)));
        const langKeys = Object.keys(reconKeysForNamespace(lang, ns));
        const extras = langKeys.filter(k => !enKeys.has(k));
        expect(
          extras,
          `${lang}/${ns}.json has Recon keys not present in en (likely typos):\n${extras.join('\n')}`
        ).toEqual([]);
      });
    }
  }

  it('at least one gateway namespace carries Recon keys', () => {
    const total = NAMESPACES.reduce(
      (acc, ns) => acc + Object.keys(reconKeysForNamespace('en', ns)).length,
      0
    );
    expect(total, 'No Recon keys found in any gateway namespace').toBeGreaterThan(0);
  });
});

describe('Recon i18n — banned vocabulary (gateway translations)', () => {
  for (const lang of LANGUAGES) {
    for (const ns of NAMESPACES) {
      it(`${lang}/${ns}.json — Recon-scoped values contain no banned vocabulary`, () => {
        const entries = reconKeysForNamespace(lang, ns);
        const hits: string[] = [];

        for (const [key, value] of Object.entries(entries)) {
          for (const term of BANNED_TERMS) {
            const pattern = new RegExp(`\\b${term}\\b`, 'i');
            if (pattern.test(value)) {
              hits.push(`${lang}/${ns}.json :: ${key} — matched "${term}" in: ${value}`);
            }
          }
        }

        expect(
          hits,
          `Banned vocabulary found in Recon i18n:\n${hits.join('\n')}`
        ).toEqual([]);
      });
    }
  }
});
