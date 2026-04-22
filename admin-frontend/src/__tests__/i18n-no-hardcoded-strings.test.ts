import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');

const TEXT_BEARING_PROPS = ['title', 'placeholder', 'aria-label', 'alt'];

const TOAST_PATTERN = /toast\.(error|success|warning|info)\(\s*['"]([^'"]+)['"]/g;

const IGNORE_DIRS = [
  'node_modules',
  '__tests__',
  '__mocks__',
  'components/ui',
  '.test.',
  '.spec.',
  '.d.ts',
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

const BRAND_ALLOW_LIST = new Set([
  'WhyNot',
  'WhyNot QA',
  'Stripe',
  'GitHub',
  'Google',
  'OpenAI',
  'Anthropic',
  'OpenRouter',
  'GPT',
  'Claude',
  'Gemini',
  'CSV',
  'JSON',
  'UUID',
  'URL',
  'ID',
  'JWT',
  'MRR',
  'ARR',
  'DAU',
  'MAU',
  'API',
  'PAYG',
  'SMTP',
]);

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
  if (BRAND_ALLOW_LIST.has(trimmed)) return false;
  return /^[A-Z][a-z]/.test(trimmed) && trimmed.length > 2;
}

function scanFile(filePath: string): Array<{ line: number; text: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; text: string }> = [];

  if (!content.includes('useTranslation') && !content.includes('withTranslation')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (IGNORE_PATTERNS.some((p) => p.test(line))) continue;

      const jsxTextMatches = line.matchAll(/>([A-Z][a-z][^<{]*)</g);
      for (const match of jsxTextMatches) {
        const text = match[1].trim();
        if (isEnglishSentence(text)) {
          violations.push({ line: i + 1, text });
        }
      }

      for (const prop of TEXT_BEARING_PROPS) {
        const propRegex = new RegExp(`${prop}="([^"]+)"`, 'g');
        const propMatches = line.matchAll(propRegex);
        for (const match of propMatches) {
          if (isEnglishSentence(match[1])) {
            violations.push({ line: i + 1, text: `${prop}="${match[1]}"` });
          }
        }
      }

      const toastMatches = line.matchAll(TOAST_PATTERN);
      for (const match of toastMatches) {
        if (isEnglishSentence(match[2])) {
          violations.push({ line: i + 1, text: `toast.${match[1]}("${match[2]}")` });
        }
      }
    }
  }

  return violations;
}

function findTsAndTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.some((d) => fullPath.includes(d))) continue;
      files.push(...findTsAndTsxFiles(fullPath));
    } else if (
      (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
      !IGNORE_DIRS.some((d) => entry.name.includes(d))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const SCAN_DIRS = [
  path.join(SRC_DIR, 'pages'),
  path.join(SRC_DIR, 'components'),
  path.join(SRC_DIR, 'hooks'),
  path.join(SRC_DIR, 'lib'),
];

describe('i18n — no hardcoded English strings (admin-frontend)', () => {
  const tsxFiles = SCAN_DIRS.flatMap((dir) => findTsAndTsxFiles(dir));

  it('scanned files should use useTranslation or have no hardcoded English text', () => {
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
        `Found ${allViolations.length} hardcoded English string(s) in scanned files:\n${report}${allViolations.length > 20 ? `\n  ... and ${allViolations.length - 20} more` : ''}`
      );
    }
  });

  it('should have scanned at least 20 files', () => {
    expect(tsxFiles.length).toBeGreaterThanOrEqual(20);
  });
});
