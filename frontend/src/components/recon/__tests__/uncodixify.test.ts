import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
// @babel/traverse is a CJS module; handle default-export interop for both bundlers.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

/**
 * Uncodixify compliance — Recon files only.
 *
 * Mirrors the project-wide `design-system-compliance.test.ts` but narrows the
 * scope to Recon-owned TSX and enforces the stricter subset from the prompt
 * (A8): disallow `rounded-full` on non-icon Card/Badge/Button containers,
 * `animate-pulse` outside of Skeleton context, etc.
 *
 * Uses `@babel/parser` + `@babel/traverse` to walk JSX — className literals are
 * only checked inside real JSX attributes, so matches inside import paths or
 * strings unrelated to styling are ignored.
 */

const FRONTEND_SRC = path.resolve(__dirname, '../../..');

const TARGET_DIRS = [
  path.join(FRONTEND_SRC, 'components', 'recon'),
  path.join(FRONTEND_SRC, 'pages', 'recon'),
];

function collectTsx(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__snapshots__') continue;
      out.push(...collectTsx(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.tsx') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      out.push(full);
    }
  }
  return out;
}

const BANNED_SUBSTRINGS: { needle: string; label: string }[] = [
  { needle: 'hover:-translate-y-', label: 'hover:-translate-y-*' },
  { needle: 'hover:shadow-md', label: 'hover:shadow-md' },
  { needle: 'hover:shadow-lg', label: 'hover:shadow-lg' },
  { needle: 'animate-bounce', label: 'animate-bounce' },
  { needle: 'transition-all', label: 'transition-all' },
  { needle: 'duration-300', label: 'duration-300' },
  { needle: 'duration-500', label: 'duration-500' },
  { needle: 'rounded-2xl', label: 'rounded-2xl' },
  { needle: 'rounded-3xl', label: 'rounded-3xl' },
  { needle: 'bg-gradient-to-', label: 'bg-gradient-to-*' },
  { needle: 'backdrop-blur', label: 'backdrop-blur' },
  { needle: 'scale-105', label: 'scale-105' },
  { needle: 'scale-110', label: 'scale-110' },
];

const CONTAINER_ELEMENTS = new Set(['Card', 'Badge', 'Button']);

interface Violation {
  file: string;
  line: number;
  element: string;
  value: string;
  reason: string;
}

function hasRingOffsetCombo(value: string): boolean {
  const tokens = value.split(/\s+/);
  const hasRing2 = tokens.some((t) => t === 'ring-2' || t.endsWith(':ring-2'));
  const hasOffset2 = tokens.some(
    (t) => t === 'ring-offset-2' || t.endsWith(':ring-offset-2'),
  );
  return hasRing2 && hasOffset2;
}

function isIconOnlyButton(attributes: Array<{ name: string; value: string }>): boolean {
  // Heuristic: an icon-only button is an inline affordance. We treat an
  // explicit aria-label with no visible text children, OR `size="icon"`,
  // OR `size="sm"` + `variant="ghost"` as icon-only.
  const size = attributes.find((a) => a.name === 'size')?.value ?? '';
  if (size === 'icon') return true;
  return false;
}

function collectAttrs(openingEl: {
  attributes: Array<{ type: string; name?: { name?: string }; value?: unknown }>;
}): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  for (const attr of openingEl.attributes) {
    if (attr.type !== 'JSXAttribute' || !attr.name?.name) continue;
    const v = attr.value as
      | { type: string; value?: string; expression?: { type: string; value?: string } }
      | undefined;
    let literal = '';
    if (v) {
      if (v.type === 'StringLiteral' && typeof v.value === 'string') {
        literal = v.value;
      } else if (
        v.type === 'JSXExpressionContainer' &&
        v.expression &&
        v.expression.type === 'StringLiteral' &&
        typeof v.expression.value === 'string'
      ) {
        literal = v.expression.value;
      }
    }
    out.push({ name: String(attr.name.name), value: literal });
  }
  return out;
}

function getElementName(openingEl: {
  name: { type: string; name?: string; property?: { name?: string } };
}): string {
  const n = openingEl.name;
  if (n.type === 'JSXIdentifier' && n.name) return n.name;
  if (n.type === 'JSXMemberExpression' && n.property?.name) return n.property.name;
  return '';
}

function classNameValueFromStringLiteral(
  attr: { type: string; value?: unknown } | undefined,
): string | null {
  if (!attr) return null;
  const v = attr.value as
    | { type: string; value?: string; expression?: { type: string; value?: string; quasis?: Array<{ value?: { cooked?: string } }> } }
    | undefined;
  if (!v) return null;
  if (v.type === 'StringLiteral' && typeof v.value === 'string') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression) {
    const e = v.expression;
    if (e.type === 'StringLiteral' && typeof e.value === 'string') return e.value;
    if (e.type === 'TemplateLiteral' && Array.isArray(e.quasis)) {
      return e.quasis.map((q) => q.value?.cooked ?? '').join(' ');
    }
  }
  return null;
}

function gatherClassNameLiterals(file: string): Array<{
  line: number;
  element: string;
  value: string;
  attributes: Array<{ name: string; value: string }>;
}> {
  const src = fs.readFileSync(file, 'utf-8');
  const results: Array<{
    line: number;
    element: string;
    value: string;
    attributes: Array<{ name: string; value: string }>;
  }> = [];

  let ast;
  try {
    ast = parse(src, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return results;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traverse(ast as any, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSXOpeningElement(nodePath: any) {
      const openingEl = nodePath.node;
      const element = getElementName(openingEl);
      const attrs = collectAttrs(openingEl);
      const cnAttr = openingEl.attributes.find(
        (a: { type: string; name?: { name?: string } }) =>
          a.type === 'JSXAttribute' && a.name?.name === 'className',
      );
      const value = classNameValueFromStringLiteral(cnAttr);
      if (value === null) return;
      const line = openingEl.loc?.start?.line ?? 0;
      results.push({ line, element, value, attributes: attrs });
    },
  });

  return results;
}

function isRoundedFullOnContainer(value: string, element: string, attrs: Array<{ name: string; value: string }>): boolean {
  if (!CONTAINER_ELEMENTS.has(element)) return false;
  const tokens = value.split(/\s+/);
  if (!tokens.includes('rounded-full')) return false;
  if (element === 'Button' && isIconOnlyButton(attrs)) return false;
  return true;
}

function isBareAnimatePulseOnNonSkeleton(value: string, element: string): boolean {
  const tokens = value.split(/\s+/);
  if (!tokens.includes('animate-pulse')) return false;
  if (element === 'Skeleton') return false;
  // Allow on loading placeholder divs that only carry bg-muted (no content).
  // This mirrors the carve-out in the project-wide compliance test.
  if (element === 'div' && tokens.some((t) => t.startsWith('bg-muted'))) return false;
  return true;
}

describe('uncodixify — Recon-scope compliance (AST)', () => {
  const files = TARGET_DIRS.flatMap(collectTsx);

  it('scans at least one Recon tsx file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no banned Uncodixify classNames in Recon components/pages', () => {
    const violations: Violation[] = [];

    for (const file of files) {
      const rel = path.relative(FRONTEND_SRC, file);
      const literals = gatherClassNameLiterals(file);
      for (const { line, element, value, attributes } of literals) {
        for (const { needle, label } of BANNED_SUBSTRINGS) {
          if (value.includes(needle)) {
            violations.push({
              file: rel,
              line,
              element,
              value,
              reason: `banned pattern: ${label}`,
            });
          }
        }
        if (hasRingOffsetCombo(value)) {
          violations.push({
            file: rel,
            line,
            element,
            value,
            reason: 'ring-2 + ring-offset-2 combo (use ring-1 ring-primary)',
          });
        }
        if (isRoundedFullOnContainer(value, element, attributes)) {
          violations.push({
            file: rel,
            line,
            element,
            value,
            reason: `rounded-full on <${element}> (allowed only on icon-only buttons)`,
          });
        }
        if (isBareAnimatePulseOnNonSkeleton(value, element)) {
          violations.push({
            file: rel,
            line,
            element,
            value,
            reason: `animate-pulse on <${element}> (allow only on <Skeleton>)`,
          });
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line}  <${v.element}>  "${v.value}"\n    → ${v.reason}`,
        )
        .join('\n');
      expect.fail(
        `Found ${violations.length} Uncodixify violation(s) in Recon scope:\n${report}\n\n` +
          'See .claude/rules/uncodixify-ui.md',
      );
    }
  });
});
