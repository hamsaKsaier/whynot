import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');

const TEXT_BEARING_ELEMENTS = [
  'Button',
  'Label',
  'CardTitle',
  'CardDescription',
  'AlertTitle',
  'AlertDescription',
  'TabsTrigger',
  'DialogTitle',
  'DialogDescription',
  'DropdownMenuItem',
  'SelectItem',
  'Badge',
];

const TEXT_BEARING_HTML = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'th', 'td'];

const TEXT_BEARING_PROPS = ['title', 'placeholder', 'aria-label', 'alt'];

const IGNORE_DIRS = [
  'node_modules',
  '__tests__',
  'components/ui',
  '.test.',
  '.spec.',
  'DesignSystemPage',
];

const IGNORE_PATTERNS = [
  /className=/,
  /data-/,
  /id="/,
  /htmlFor="/,
  /key="/,
  /variant="/,
  /size="/,
  /type="/,
  /href="/,
  /to="/,
  /name="/,
  /value="/,
  /asChild/,
  /import /,
  /export /,
  /const /,
  /function /,
  /return /,
  /console\./,
];

function isEnglishSentence(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 3) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[^a-zA-Z]*$/.test(trimmed)) return false;
  if (/^\{\{/.test(trimmed)) return false;
  if (/^t\(/.test(trimmed)) return false;
  if (/^[A-Z_]+$/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^[a-z]+\.[a-z]+/.test(trimmed)) return false;
  // Must start with uppercase and contain at least one lowercase letter (looks like English text)
  return /^[A-Z][a-z]/.test(trimmed) && trimmed.length > 2;
}

function scanFile(filePath: string): Array<{ line: number; text: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; text: string }> = [];

  // Skip files that already import useTranslation
  if (!content.includes('useTranslation') && !content.includes('withTranslation')) {
    // File doesn't use i18n at all — check for user-facing strings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip non-JSX lines
      if (IGNORE_PATTERNS.some((p) => p.test(line))) continue;

      // Check for hardcoded strings in JSX text content: >Some text<
      const jsxTextMatches = line.matchAll(/>([A-Z][a-z][^<{]*)</g);
      for (const match of jsxTextMatches) {
        const text = match[1].trim();
        if (isEnglishSentence(text)) {
          violations.push({ line: i + 1, text });
        }
      }

      // Check for hardcoded strings in text-bearing props
      for (const prop of TEXT_BEARING_PROPS) {
        const propRegex = new RegExp(`${prop}="([^"]+)"`, 'g');
        const propMatches = line.matchAll(propRegex);
        for (const match of propMatches) {
          if (isEnglishSentence(match[1])) {
            violations.push({ line: i + 1, text: `${prop}="${match[1]}"` });
          }
        }
      }
    }
  }

  return violations;
}

function findTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.some((d) => fullPath.includes(d))) continue;
      files.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') && !IGNORE_DIRS.some((d) => entry.name.includes(d))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('i18n — no hardcoded English strings', () => {
  const tsxFiles = findTsxFiles(path.join(SRC_DIR, 'pages'));

  it('page files should use useTranslation or have no hardcoded English text', () => {
    const allViolations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of tsxFiles) {
      const violations = scanFile(file);
      for (const v of violations) {
        allViolations.push({
          file: path.relative(SRC_DIR, file),
          ...v,
        });
      }
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .slice(0, 20)
        .map((v) => `  ${v.file}:${v.line} — "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found ${allViolations.length} hardcoded English string(s) in page files:\n${report}${allViolations.length > 20 ? `\n  ... and ${allViolations.length - 20} more` : ''}`
      );
    }
  });
});
