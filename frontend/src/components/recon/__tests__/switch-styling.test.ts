import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

/**
 * Switch-component styling regression — Recon scope only.
 *
 * Enforces `.claude/rules/switch-component-styling.md`:
 *   NEVER apply `min-h-[44px]` or `min-w-[44px]` directly to a <Switch>.
 * The rule exists because the shadcn Switch has a fixed pill shape and
 * stretching the root element deforms the track.
 *
 * Walks JSX; inspects each `<Switch>` opening element's className literal
 * (or template literal), ignoring matches elsewhere in the file.
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

function extractClassName(
  attr: { type: string; value?: unknown } | undefined,
): string | null {
  if (!attr) return null;
  const v = attr.value as
    | {
        type: string;
        value?: string;
        expression?: {
          type: string;
          value?: string;
          quasis?: Array<{ value?: { cooked?: string } }>;
          arguments?: Array<unknown>;
        };
      }
    | undefined;
  if (!v) return null;
  if (v.type === 'StringLiteral' && typeof v.value === 'string') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression) {
    const e = v.expression;
    if (e.type === 'StringLiteral' && typeof e.value === 'string') return e.value;
    if (e.type === 'TemplateLiteral' && Array.isArray(e.quasis)) {
      return e.quasis.map((q) => q.value?.cooked ?? '').join(' ');
    }
    if (
      e.type === 'CallExpression' &&
      Array.isArray(e.arguments)
    ) {
      // Handle cn("foo", cond && "bar") etc. by flattening string-ish args.
      const parts: string[] = [];
      for (const arg of e.arguments) {
        const a = arg as {
          type?: string;
          value?: string;
          quasis?: Array<{ value?: { cooked?: string } }>;
          consequent?: { type?: string; value?: string };
          alternate?: { type?: string; value?: string };
          right?: { type?: string; value?: string };
        };
        if (a.type === 'StringLiteral' && typeof a.value === 'string') {
          parts.push(a.value);
        } else if (a.type === 'TemplateLiteral' && Array.isArray(a.quasis)) {
          parts.push(a.quasis.map((q) => q.value?.cooked ?? '').join(' '));
        } else if (a.type === 'ConditionalExpression') {
          if (a.consequent?.type === 'StringLiteral' && typeof a.consequent.value === 'string') {
            parts.push(a.consequent.value);
          }
          if (a.alternate?.type === 'StringLiteral' && typeof a.alternate.value === 'string') {
            parts.push(a.alternate.value);
          }
        } else if (a.type === 'LogicalExpression') {
          if (a.right?.type === 'StringLiteral' && typeof a.right.value === 'string') {
            parts.push(a.right.value);
          }
        }
      }
      return parts.join(' ');
    }
  }
  return null;
}

interface Violation {
  file: string;
  line: number;
  className: string;
  token: string;
}

describe('Switch component styling regression — Recon scope', () => {
  const files = TARGET_DIRS.flatMap(collectTsx);

  it('scans at least one Recon tsx file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('does not apply min-h-[44px] or min-w-[44px] directly to <Switch>', () => {
    const violations: Violation[] = [];

    for (const file of files) {
      const rel = path.relative(FRONTEND_SRC, file);
      const src = fs.readFileSync(file, 'utf-8');

      let ast;
      try {
        ast = parse(src, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true,
        });
      } catch {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      traverse(ast as any, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        JSXOpeningElement(nodePath: any) {
          const openingEl = nodePath.node;
          const name = openingEl.name;
          const elementName =
            name.type === 'JSXIdentifier'
              ? String(name.name)
              : name.type === 'JSXMemberExpression'
                ? String(name.property?.name ?? '')
                : '';
          if (elementName !== 'Switch') return;

          const cnAttr = openingEl.attributes.find(
            (a: { type: string; name?: { name?: string } }) =>
              a.type === 'JSXAttribute' && a.name?.name === 'className',
          );
          const cn = extractClassName(cnAttr);
          if (!cn) return;
          const tokens = cn.split(/\s+/);
          for (const banned of ['min-h-[44px]', 'min-w-[44px]']) {
            if (tokens.includes(banned)) {
              violations.push({
                file: rel,
                line: openingEl.loc?.start?.line ?? 0,
                className: cn,
                token: banned,
              });
            }
          }
        },
      });
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line}  <Switch> has "${v.token}" in className="${v.className}"`,
        )
        .join('\n');
      expect.fail(
        `Found ${violations.length} Switch styling violation(s):\n${report}\n\n` +
          'See .claude/rules/switch-component-styling.md — put touch-target sizing on the parent row, not on <Switch>.',
      );
    }
  });
});
