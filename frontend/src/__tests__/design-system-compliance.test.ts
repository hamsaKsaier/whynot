import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');

/**
 * Recursively collect all .tsx files under a directory,
 * skipping node_modules, __tests__, and test files.
 */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      results.push(...collectTsxFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.tsx') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      results.push(full);
    }
  }
  return results;
}

/** Files that are allowed exceptions (shadcn UI primitives, skeleton loaders). */
const ALLOWED_EXCEPTIONS: Record<string, string[]> = {
  // shadcn accordion needs transition-all for height animation
  'components/ui/accordion.tsx': ['transition-all'],
  // shadcn overlays use bg-black/80 — always-dark scrim is semantically correct
  'components/ui/dialog.tsx': ['bg-black/80'],
  'components/ui/sheet.tsx': ['bg-black/80'],
};

/**
 * Check if a violation is in the allowed exceptions list.
 */
function isAllowedException(relPath: string, pattern: string): boolean {
  for (const [file, patterns] of Object.entries(ALLOWED_EXCEPTIONS)) {
    if (relPath.endsWith(file) && patterns.some((p) => pattern.includes(p))) {
      return true;
    }
  }
  return false;
}

/**
 * Banned patterns from .claude/rules/uncodixify-ui.md
 * Each entry: [regex, human-readable description]
 */
const BANNED_PATTERNS: [RegExp, string][] = [
  // Lift / scale on hover
  [/hover:-translate-y/, 'hover:-translate-y (card lift effect)'],
  [/hover:translate-/, 'hover:translate- (hover translation)'],
  [/hover:scale-/, 'hover:scale- (zoom on hover)'],

  // Shadow escalation on hover
  [/hover:shadow-md/, 'hover:shadow-md (shadow escalation)'],
  [/hover:shadow-lg/, 'hover:shadow-lg (shadow escalation)'],
  [/hover:shadow-xl/, 'hover:shadow-xl (shadow escalation)'],

  // Banned animations
  [/animate-bounce/, 'animate-bounce (decorative motion)'],

  // transition-all (should use transition-colors or transition-opacity)
  [/transition-all/, 'transition-all (use transition-colors or transition-opacity)'],

  // Slow durations
  [/duration-300(?!\d)/, 'duration-300 (too slow, use duration-150 or duration-200)'],
  [/duration-500/, 'duration-500 (too slow)'],
  [/duration-700/, 'duration-700 (too slow)'],
  [/duration-1000/, 'duration-1000 (too slow)'],

  // Over-rounded
  [/rounded-2xl/, 'rounded-2xl (use rounded-lg)'],
  [/rounded-3xl/, 'rounded-3xl (use rounded-lg)'],

  // Gradients in app UI
  [/bg-gradient-to-/, 'bg-gradient-to-* (use solid backgrounds)'],
  [/bg-clip-text\s+text-transparent/, 'bg-clip-text text-transparent (gradient text)'],

  // Glassmorphism
  [/backdrop-blur/, 'backdrop-blur (glassmorphism, use solid bg)'],

  // Excessive shadows
  [/\bshadow-xl\b/, 'shadow-xl (use shadow-sm max)'],
  [/shadow-2xl/, 'shadow-2xl (use shadow-sm max)'],
  [/\bshadow-lg\b/, 'shadow-lg (use shadow-sm max)'],

  // RTL forbidden pattern
  [/rtl:flex-row-reverse/, 'rtl:flex-row-reverse (native dir="rtl" handles this)'],
];

/**
 * Patterns to check for animate-pulse abuse.
 * animate-pulse is allowed ONLY on Skeleton placeholders or loading divs with bg-muted.
 */
function checkAnimatePulse(
  line: string,
  _lineNum: number
): string | null {
  if (!line.includes('animate-pulse')) return null;
  // Allow on Skeleton components
  if (line.includes('<Skeleton') || line.includes('Skeleton')) return null;
  // Allow on loading placeholder divs (bg-muted with no text content)
  if (line.includes('bg-muted') && !line.includes('>') ) return null;
  if (line.includes('bg-muted') && line.match(/className="[^"]*bg-muted[^"]*animate-pulse/)) return null;
  return 'animate-pulse on non-skeleton element';
}

describe('Design System Compliance (Uncodixify)', () => {
  const files = collectTsxFiles(SRC_DIR);

  it('should find tsx files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not contain banned UI patterns', () => {
    const violations: string[] = [];

    for (const file of files) {
      const relPath = path.relative(SRC_DIR, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        // Skip comments and imports
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (trimmed.startsWith('import ')) return;

        for (const [pattern, description] of BANNED_PATTERNS) {
          if (pattern.test(line)) {
            if (!isAllowedException(relPath, line)) {
              violations.push(`${relPath}:${lineNum}: ${description}`);
            }
          }
        }

        // Special animate-pulse check
        const pulseViolation = checkAnimatePulse(line, lineNum);
        if (pulseViolation && !isAllowedException(relPath, line)) {
          violations.push(`${relPath}:${lineNum}: ${pulseViolation}`);
        }
      });
    }

    if (violations.length > 0) {
      const report = violations.join('\n');
      expect.fail(
        `Found ${violations.length} design system violation(s):\n\n${report}\n\n` +
          'See .claude/rules/uncodixify-ui.md for allowed patterns.'
      );
    }
  });

  it('should not contain physical directional margin/padding classes', () => {
    const violations: string[] = [];
    // Match ml-*, mr-*, pl-*, pr-* but not ms-*, me-*, ps-*, pe-*
    // Also exclude -ml- (negative margins used in specific UI patterns)
    const physicalDirPattern = /\b(ml-|mr-|pl-|pr-)(?!auto\b)/;

    for (const file of files) {
      const relPath = path.relative(SRC_DIR, file);
      // Skip shadcn UI primitives — they use Radix defaults
      if (relPath.startsWith('components/ui/')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) return;

        if (physicalDirPattern.test(line)) {
          violations.push(`${relPath}:${lineNum}: physical directional class found`);
        }
      });
    }

    if (violations.length > 0) {
      const report = violations.join('\n');
      expect.fail(
        `Found ${violations.length} physical directional class(es) (use ms-/me-/ps-/pe- for RTL support):\n\n${report}\n\n` +
          'See .claude/rules/rtl-support-arabic.md for allowed patterns.'
      );
    }
  });
});
