import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Static scan test for Uncodixify design system compliance.
 * Scans all .tsx/.ts source files in admin-frontend/src for banned patterns
 * defined in .claude/rules/uncodixify-ui.md and STYLES.md.
 */

const SRC_DIR = path.resolve(__dirname, '..');

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Patterns that are always banned with no exceptions.
 */
const ALWAYS_BANNED: { name: string; pattern: RegExp }[] = [
  { name: 'hover:-translate-y (card lift effect)', pattern: /hover:-translate-y/ },
  { name: 'hover:shadow-md (shadow escalation on hover)', pattern: /hover:shadow-md/ },
  { name: 'hover:shadow-lg (shadow escalation on hover)', pattern: /hover:shadow-lg/ },
  { name: 'animate-bounce (decorative animation)', pattern: /animate-bounce/ },
  { name: 'rounded-2xl (over-rounded)', pattern: /rounded-2xl/ },
  { name: 'rounded-3xl (over-rounded)', pattern: /rounded-3xl/ },
  { name: 'bg-gradient-to (gradient background)', pattern: /bg-gradient-to/ },
  { name: 'backdrop-blur (glassmorphism)', pattern: /backdrop-blur/ },
  { name: 'bg-clip-text text-transparent (gradient text)', pattern: /bg-clip-text/ },
  { name: 'hover:scale- (zoom effect)', pattern: /hover:scale-/ },
  { name: 'rtl:flex-row-reverse (double-reversal)', pattern: /rtl:flex-row-reverse/ },
  { name: 'text-white (hardcoded color)', pattern: /\btext-white\b/ },
  { name: 'bg-white (hardcoded color)', pattern: /\bbg-white\b/ },
  { name: 'bg-black (hardcoded color, not opacity)', pattern: /\bbg-black(?!\/)\b/ },
  { name: 'text-left (physical property)', pattern: /\btext-left\b/ },
  { name: 'text-right (physical property)', pattern: /\btext-right\b/ },
  { name: 'float-left (physical property)', pattern: /\bfloat-left\b/ },
  { name: 'float-right (physical property)', pattern: /\bfloat-right\b/ },
];

/**
 * Patterns banned in component files (pages + components), but allowed
 * in specific shadcn primitive contexts where noted.
 */
const BANNED_IN_PAGES: { name: string; pattern: RegExp }[] = [
  { name: 'ml- (physical margin, use ms-)', pattern: /\bml-\d/ },
  { name: 'mr- (physical margin, use me-)', pattern: /\bmr-\d/ },
  { name: 'pl- (physical padding, use ps-)', pattern: /\bpl-\d/ },
  { name: 'pr- (physical padding, use pe-)', pattern: /\bpr-\d/ },
  { name: 'border-l- (physical border, use border-s-)', pattern: /\bborder-l-\d/ },
  { name: 'border-r- (physical border, use border-e-)', pattern: /\bborder-r-\d/ },
  { name: 'rounded-l- (physical radius, use rounded-s-)', pattern: /\brounded-l-/ },
  { name: 'rounded-r- (physical radius, use rounded-e-)', pattern: /\brounded-r-/ },
];

describe('Design System Compliance — Uncodixify', () => {
  const sourceFiles = getAllSourceFiles(SRC_DIR);

  it('found source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  describe('always-banned patterns', () => {
    for (const rule of ALWAYS_BANNED) {
      it(`no files contain ${rule.name}`, () => {
        const violations: string[] = [];
        for (const filePath of sourceFiles) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (rule.pattern.test(lines[i])) {
              const rel = path.relative(SRC_DIR, filePath);
              violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
        expect(violations, `Found ${rule.name}:\n${violations.join('\n')}`).toHaveLength(0);
      });
    }
  });

  describe('physical directional properties banned in pages and components', () => {
    const pageAndComponentFiles = sourceFiles.filter(
      (f) => f.includes('/pages/') || f.includes('/components/')
    );

    for (const rule of BANNED_IN_PAGES) {
      it(`no page/component files contain ${rule.name}`, () => {
        const violations: string[] = [];
        for (const filePath of pageAndComponentFiles) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (rule.pattern.test(lines[i])) {
              const rel = path.relative(SRC_DIR, filePath);
              violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
        expect(violations, `Found ${rule.name}:\n${violations.join('\n')}`).toHaveLength(0);
      });
    }
  });

  describe('transition-all banned (use transition-colors or transition-opacity)', () => {
    it('no files use transition-all outside of Radix accordion content animation', () => {
      const violations: string[] = [];
      for (const filePath of sourceFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/transition-all/.test(lines[i])) {
            // Allow AccordionContent which needs transition-all for Radix height animation
            const isAccordionContent =
              filePath.endsWith('accordion.tsx') &&
              lines[i].includes('animate-accordion');
            if (!isAccordionContent) {
              const rel = path.relative(SRC_DIR, filePath);
              violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      }
      expect(violations, `Found transition-all:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });

  describe('shadow depth limits', () => {
    it('no files use shadow-xl or shadow-2xl', () => {
      const violations: string[] = [];
      for (const filePath of sourceFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/\bshadow-xl\b|\bshadow-2xl\b/.test(lines[i])) {
            const rel = path.relative(SRC_DIR, filePath);
            violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
      expect(violations, `Found excessive shadows:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });

  describe('duration limits', () => {
    it('no files use duration-300 or higher', () => {
      const violations: string[] = [];
      for (const filePath of sourceFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/\bduration-(300|500|700|1000)\b/.test(lines[i])) {
            const rel = path.relative(SRC_DIR, filePath);
            violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
      expect(violations, `Found slow durations:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });

  describe('hardcoded hex colors', () => {
    it('no component files use bg-[#...] or text-[#...]', () => {
      const violations: string[] = [];
      const componentFiles = sourceFiles.filter(
        (f) => f.includes('/pages/') || f.includes('/components/')
      );
      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/\b(bg|text)-\[#[0-9a-fA-F]+\]/.test(lines[i])) {
            const rel = path.relative(SRC_DIR, filePath);
            violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
      expect(violations, `Found hardcoded hex:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });

  describe('directional icon RTL compliance', () => {
    it('all directional icon usages include rtl:scale-x-[-1]', () => {
      const violations: string[] = [];
      const dirIcons = ['ChevronRight', 'ChevronLeft', 'ArrowRight', 'ArrowLeft'];
      const componentFiles = sourceFiles.filter(
        (f) => f.includes('/pages/') || f.includes('/components/')
      );
      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip import lines
          if (/^\s*import\b/.test(line)) continue;
          for (const icon of dirIcons) {
            // Match JSX usage like <ChevronRight or <ArrowLeft
            if (new RegExp(`<${icon}\\b`).test(line)) {
              // Check this line and next few for rtl:scale-x-[-1]
              const context = lines.slice(i, i + 3).join(' ');
              if (!/rtl:scale-x-\[-1\]/.test(context)) {
                const rel = path.relative(SRC_DIR, filePath);
                violations.push(`${rel}:${i + 1}: ${icon} missing rtl:scale-x-[-1]`);
              }
            }
          }
        }
      }
      expect(violations, `Missing RTL mirror:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });
});
