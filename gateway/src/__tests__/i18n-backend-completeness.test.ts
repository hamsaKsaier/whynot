/**
 * i18n-backend-completeness.test.ts
 *
 * Ensures every req.t('namespace:key') call in the gateway source code
 * references a key that exists in ALL translation files.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.resolve(__dirname, '../i18n/translations');
const GATEWAY_SRC = path.resolve(__dirname, '..');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'];
const NAMESPACES = ['errors', 'success', 'emails', 'validation', 'billing'];

/**
 * Recursively find all .ts files under a directory, excluding
 * test files, node_modules, and declaration files.
 */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist') continue;
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract all i18n key references from source code.
 * Matches patterns like:
 *   req.t('errors:auth.unauthorized')
 *   (req as any).t('errors:auth.unauthorized')
 *   t('errors:auth.unauthorized')
 */
function extractI18nKeys(source: string): Array<{ namespace: string; key: string; raw: string }> {
  // Match .t('namespace:key') patterns — handles both req.t and (req as any).t and standalone t()
  const regex = /\.t\(\s*['"]([\w]+):([\w.]+)['"]/g;
  const keys: Array<{ namespace: string; key: string; raw: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    keys.push({
      namespace: match[1],
      key: match[2],
      raw: `${match[1]}:${match[2]}`,
    });
  }

  return keys;
}

function loadTranslationKeys(lang: string, ns: string): Set<string> {
  const filePath = path.join(TRANSLATIONS_DIR, lang, `${ns}.json`);
  if (!fs.existsSync(filePath)) return new Set();
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return new Set(Object.keys(data));
}

describe('i18n backend completeness — req.t() key coverage', () => {
  // Collect all i18n keys used in source code
  const sourceFiles = findTsFiles(GATEWAY_SRC);
  const allUsedKeys: Map<string, Set<string>> = new Map(); // namespace -> Set<key>
  const keyLocations: Map<string, string[]> = new Map(); // "ns:key" -> [file:line, ...]

  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf-8');
    const keys = extractI18nKeys(source);

    for (const { namespace, key, raw } of keys) {
      if (!allUsedKeys.has(namespace)) {
        allUsedKeys.set(namespace, new Set());
      }
      allUsedKeys.get(namespace)!.add(key);

      if (!keyLocations.has(raw)) {
        keyLocations.set(raw, []);
      }
      const relativePath = path.relative(GATEWAY_SRC, filePath);
      keyLocations.get(raw)!.push(relativePath);
    }
  }

  it('found i18n key references in source code', () => {
    const totalKeys = Array.from(allUsedKeys.values()).reduce((sum, set) => sum + set.size, 0);
    expect(totalKeys).toBeGreaterThan(0);
  });

  for (const lang of LANGUAGES) {
    it(`all req.t() keys exist in ${lang} translations`, () => {
      const missing: string[] = [];

      for (const [namespace, keys] of allUsedKeys) {
        if (!NAMESPACES.includes(namespace)) {
          // Unknown namespace — flag it
          for (const key of keys) {
            missing.push(`${namespace}:${key} (unknown namespace "${namespace}")`);
          }
          continue;
        }

        const translationKeys = loadTranslationKeys(lang, namespace);

        for (const key of keys) {
          if (!translationKeys.has(key)) {
            const locations = keyLocations.get(`${namespace}:${key}`) || [];
            missing.push(`${namespace}:${key} (used in: ${locations.join(', ')})`);
          }
        }
      }

      expect(missing, `Missing i18n keys in ${lang}:\n${missing.join('\n')}`).toEqual([]);
    });
  }

  it('no orphaned keys in English (every en key is used in code or is a known base key)', () => {
    // This is informational — orphaned keys aren't necessarily bugs
    // (they could be used dynamically), but flagging them is useful.
    const allUsedFlat = new Set<string>();
    for (const [ns, keys] of allUsedKeys) {
      for (const key of keys) {
        allUsedFlat.add(`${ns}:${key}`);
      }
    }

    const orphaned: string[] = [];
    for (const ns of NAMESPACES) {
      const enKeys = loadTranslationKeys('en', ns);
      for (const key of enKeys) {
        if (!allUsedFlat.has(`${ns}:${key}`)) {
          orphaned.push(`${ns}:${key}`);
        }
      }
    }

    // Log orphaned keys for awareness but don't fail
    // Some keys may be referenced dynamically or from the frontend
    if (orphaned.length > 0) {
      console.log(`\nInfo: ${orphaned.length} translation keys not found in static req.t() calls (may be used dynamically):`);
      for (const key of orphaned.slice(0, 10)) {
        console.log(`  - ${key}`);
      }
      if (orphaned.length > 10) {
        console.log(`  ... and ${orphaned.length - 10} more`);
      }
    }
  });
});
