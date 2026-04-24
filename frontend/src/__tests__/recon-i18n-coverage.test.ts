import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const NON_EN_LANGUAGES = LANGUAGES.filter(l => l !== 'en');

// Namespaces + filter predicates for Recon-scoped keys.
// - `recon.json`: the whole file.
// - everything else: only keys that mention `recon` in the dotted path.
const RECON_NAMESPACES: Array<{ ns: string; filter: (key: string) => boolean }> = [
  { ns: 'recon', filter: () => true },
  { ns: 'common', filter: k => /(^|\.)recon(\.|$)/i.test(k) },
  { ns: 'landing', filter: k => /(^|\.)recon(\.|$)/i.test(k) },
  { ns: 'settings', filter: k => /(^|\.)recon(\.|$)/i.test(k) },
];

// Banned vocabulary — rule recon-safety.md §6.
// Matched case-insensitively as whole words inside translated string values.
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
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function reconKeysForNamespace(lang: string, ns: string, filter: (key: string) => boolean) {
  const flat = flatten(loadJson(lang, ns));
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (filter(key)) filtered[key] = value;
  }
  return filtered;
}

describe('Recon i18n — 5-language coverage (frontend)', () => {
  for (const { ns, filter } of RECON_NAMESPACES) {
    it(`en/${ns}.json exposes at least one Recon key`, () => {
      const keys = Object.keys(reconKeysForNamespace('en', ns, filter));
      expect(
        keys.length,
        `en/${ns}.json has zero Recon-scoped keys — canonical source is empty`
      ).toBeGreaterThan(0);
    });

    for (const lang of NON_EN_LANGUAGES) {
      it(`${lang}/${ns}.json — every Recon key from en exists with a non-empty value`, () => {
        const enEntries = reconKeysForNamespace('en', ns, filter);
        const langEntries = reconKeysForNamespace(lang, ns, filter);

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
        const enKeys = new Set(Object.keys(reconKeysForNamespace('en', ns, filter)));
        const langKeys = Object.keys(reconKeysForNamespace(lang, ns, filter));
        const extras = langKeys.filter(k => !enKeys.has(k));
        expect(
          extras,
          `${lang}/${ns}.json has Recon keys not present in en (likely typos):\n${extras.join('\n')}`
        ).toEqual([]);
      });
    }
  }
});

describe('Recon i18n — banned vocabulary (frontend locales)', () => {
  for (const lang of LANGUAGES) {
    for (const { ns, filter } of RECON_NAMESPACES) {
      it(`${lang}/${ns}.json — Recon-scoped values contain no banned vocabulary`, () => {
        const entries = reconKeysForNamespace(lang, ns, filter);
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

describe('Recon i18n — Arabic RTL sanity spot-check', () => {
  // Catches stray `dir="ltr"` or `direction: ltr` in translated content
  // that would override the global RTL direction inherited from `<html dir="rtl">`.
  it('5 randomly-sampled Arabic Recon strings contain no hardcoded LTR direction override', () => {
    const arEntries = reconKeysForNamespace('ar', 'recon', () => true);
    const keys = Object.keys(arEntries);
    expect(keys.length, 'ar/recon.json has no keys to sample').toBeGreaterThan(0);

    // Deterministic pseudo-random sample for stable CI output.
    const sampleSize = Math.min(5, keys.length);
    const hash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    };
    const sorted = [...keys].sort((a, b) => hash(a) - hash(b));
    const sampled = sorted.slice(0, sampleSize);

    const container = document.createElement('div');
    container.setAttribute('dir', 'rtl');
    document.body.appendChild(container);

    try {
      const leaks: string[] = [];
      for (const key of sampled) {
        const value = arEntries[key];

        // Render the string to confirm it doesn't explode in a jsdom RTL container.
        const span = document.createElement('span');
        span.textContent = value;
        container.appendChild(span);

        // Inherited direction on the element (or its nearest ancestor with a dir
        // attribute) must be RTL. jsdom doesn't compute CSS-inherited direction,
        // so we resolve via the attribute chain instead.
        let dirEl: HTMLElement | null = span;
        let resolvedDir = '';
        while (dirEl) {
          const attr = dirEl.getAttribute('dir');
          if (attr) {
            resolvedDir = attr;
            break;
          }
          dirEl = dirEl.parentElement;
        }
        if (resolvedDir !== 'rtl') {
          leaks.push(`${key}: resolved dir="${resolvedDir}" but expected "rtl"`);
        }

        // Core assertion: no hardcoded `dir="ltr"` or `direction: ltr` string
        // leaked into the translation content.
        if (/\bdir\s*=\s*["']?ltr/i.test(value) || /direction\s*:\s*ltr/i.test(value)) {
          leaks.push(`${key}: contains hardcoded LTR override — "${value}"`);
        }
      }

      expect(leaks, `RTL leaks in sampled Arabic Recon strings:\n${leaks.join('\n')}`).toEqual([]);
    } finally {
      container.remove();
    }
  });
});
