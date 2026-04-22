import { describe, test, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
const DOCS_ROOT = path.resolve(__dirname, '../../../docs');

let fixtureExtraEnPath: string | null = null;

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function collectRelPaths(lang: string): Set<string> {
  const langDir = path.join(DOCS_ROOT, lang);
  const paths = new Set(
    walkDir(langDir).map((f) => path.relative(langDir, f))
  );
  if (lang === 'en' && fixtureExtraEnPath) {
    paths.add(fixtureExtraEnPath);
  }
  return paths;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  return content.slice(end + 4);
}

function extractHeadings(content: string): {
  h1: number;
  h2: number;
  h3: number;
} {
  const body = stripFrontmatter(content);
  const lines = body.split('\n');
  let inCodeBlock = false;
  const result = { h1: 0, h2: 0, h3: 0 };

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (trimmed.startsWith('### ')) result.h3++;
    else if (trimmed.startsWith('## ')) result.h2++;
    else if (trimmed.startsWith('# ')) result.h1++;
  }

  return result;
}

function parseFrontmatter(
  content: string
): Record<string, string> | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const yaml = content.slice(4, end);
  const result: Record<string, string> = {};
  for (const line of yaml.split('\n')) {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (match) {
      result[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

describe('docs parity across all 5 languages', () => {
  afterEach(() => {
    fixtureExtraEnPath = null;
  });

  test('all languages have identical file trees', () => {
    const enPaths = collectRelPaths('en');
    expect(enPaths.size).toBeGreaterThan(0);

    for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
      const langPaths = collectRelPaths(lang);
      const missing = [...enPaths].filter((p) => !langPaths.has(p));
      const extra = [...langPaths].filter((p) => !enPaths.has(p));
      expect(
        missing,
        `${lang}/ is missing files that exist in en/: ${missing.join(', ')}`
      ).toEqual([]);
      expect(
        extra,
        `${lang}/ has extra files not in en/: ${extra.join(', ')}`
      ).toEqual([]);
    }
  });

  test('heading structure parity per file', () => {
    const enPaths = collectRelPaths('en');

    for (const relPath of enPaths) {
      const enFile = path.join(DOCS_ROOT, 'en', relPath);
      if (!fs.existsSync(enFile)) continue;
      const enContent = fs.readFileSync(enFile, 'utf-8');
      const enHeadings = extractHeadings(enContent);

      for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
        const langFile = path.join(DOCS_ROOT, lang, relPath);
        if (!fs.existsSync(langFile)) continue;
        const langContent = fs.readFileSync(langFile, 'utf-8');
        const langHeadings = extractHeadings(langContent);
        expect(
          langHeadings,
          `Heading mismatch in ${lang}/${relPath}: got H1:${langHeadings.h1} H2:${langHeadings.h2} H3:${langHeadings.h3}, expected H1:${enHeadings.h1} H2:${enHeadings.h2} H3:${enHeadings.h3}`
        ).toEqual(enHeadings);
      }
    }
  });

  test('frontmatter is present with correct lang field', () => {
    for (const lang of LANGUAGES) {
      const langDir = path.join(DOCS_ROOT, lang);
      const files = walkDir(langDir);

      for (const file of files) {
        const relPath = path.relative(langDir, file);
        const content = fs.readFileSync(file, 'utf-8');
        const fm = parseFrontmatter(content);

        expect(
          fm,
          `${lang}/${relPath} is missing YAML frontmatter`
        ).not.toBeNull();

        if (fm) {
          expect(
            fm.title,
            `${lang}/${relPath} missing title in frontmatter`
          ).toBeDefined();
          expect(
            fm.lang,
            `${lang}/${relPath} has wrong lang field: "${fm.lang}" (expected "${lang}")`
          ).toBe(lang);
        }
      }
    }
  });

  test('seeded regression: detects when en/ has a file others lack', () => {
    fixtureExtraEnPath = '__test__.md';

    const enPaths = collectRelPaths('en');
    expect(enPaths.has('__test__.md')).toBe(true);

    for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
      const langPaths = collectRelPaths(lang);
      const missing = [...enPaths].filter((p) => !langPaths.has(p));
      expect(missing).toContain('__test__.md');
    }
  });

  test('seeded regression: clean state has no divergence', () => {
    const enPaths = collectRelPaths('en');
    expect(enPaths.has('__test__.md')).toBe(false);

    for (const lang of LANGUAGES.filter((l) => l !== 'en')) {
      const langPaths = collectRelPaths(lang);
      const missing = [...enPaths].filter((p) => !langPaths.has(p));
      const extra = [...langPaths].filter((p) => !enPaths.has(p));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    }
  });
});
