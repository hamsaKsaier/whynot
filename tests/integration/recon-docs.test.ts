/**
 * Recon documentation gates.
 *
 * Enforces the rules in .claude/rules/recon-safety.md:
 *   - Rule #6: banned vocabulary must not appear in user-facing docs.
 *   - 5-language parity: every English Recon doc has a counterpart in
 *     ar/fr/de/es with the same filename.
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCS_ROOT = path.resolve(__dirname, '../../docs');
const LANGS = ['en', 'ar', 'fr', 'de', 'es'] as const;
const RECON_DIR = 'recon';

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

function listDocs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string, prefix: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort();
}

describe('Recon docs CI gates', () => {
  describe('Banned vocabulary', () => {
    for (const lang of LANGS) {
      const dir = path.join(DOCS_ROOT, lang, RECON_DIR);
      const files = listDocs(dir);
      it(`${lang} contains no banned terms`, () => {
        const violations: string[] = [];
        for (const rel of files) {
          const content = fs.readFileSync(path.join(dir, rel), 'utf8');
          for (const term of BANNED_TERMS) {
            const re = new RegExp(`\\b${term}\\b`, 'i');
            if (re.test(content)) {
              violations.push(`${lang}/${RECON_DIR}/${rel}: "${term}"`);
            }
          }
        }
        expect(violations).toEqual([]);
      });
    }
  });

  describe('5-language parity', () => {
    const enFiles = listDocs(path.join(DOCS_ROOT, 'en', RECON_DIR));

    it('English docs exist', () => {
      expect(enFiles.length).toBeGreaterThan(0);
    });

    for (const lang of ['ar', 'fr', 'de', 'es'] as const) {
      it(`${lang} has a counterpart for every English page`, () => {
        const langDir = path.join(DOCS_ROOT, lang, RECON_DIR);
        const missing = enFiles.filter(
          (rel) => !fs.existsSync(path.join(langDir, rel))
        );
        expect(missing).toEqual([]);
      });
    }
  });
});
