import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Banned-vocabulary content guard — enforces recon-safety rule #6.
 *
 * The Recon feature MUST NOT leak vendor or third-party tool names to end
 * users. We catch leakage at two layers:
 *
 *   1. Translation JSON — every string shipped to the browser as i18n
 *      content.
 *   2. Public-facing TSX — string literals in Recon components/pages and
 *      the landing-page Recon section. This covers hardcoded copy that
 *      bypasses i18n (aria-labels, placeholder text, default-value
 *      fallbacks).
 *
 * Rendering the real pages was considered but rejected: the pages pull
 * auth/workspace/feature-flag/API providers, so a static scan of source
 * text and JSON is both cheaper and strictly more conservative (it sees
 * the copy even if a render path is gated behind a prop).
 */

const FRONTEND = path.resolve(__dirname, '../../../..');
const LOCALES_DIR = path.join(FRONTEND, 'public', 'locales');
const COMPONENTS_RECON = path.join(FRONTEND, 'src', 'components', 'recon');
const PAGES_RECON = path.join(FRONTEND, 'src', 'pages', 'recon');
const LANDING_SECTION = path.join(
  FRONTEND,
  'src',
  'components',
  'landing',
  'ReconFeatureSection.tsx',
);
const SETTINGS_TAB = path.join(
  FRONTEND,
  'src',
  'pages',
  'settings',
  'tabs',
  'ReconSettingsTab.tsx',
);

/**
 * Banned identifiers (case-insensitive, word-boundary).
 * Sourced from `.claude/rules/recon-safety.md` §6.
 *
 * NOTE: these strings MUST NOT appear in user-facing output — code
 * identifiers, internal documentation, and test files are out of scope.
 */
const BANNED = [
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

function bannedRegex(word: string): RegExp {
  // Case-insensitive, word-boundary to avoid e.g. "Anthro" false-positives.
  return new RegExp(`\\b${word}\\b`, 'i');
}

function collectFilesByExt(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__snapshots__') continue;
      out.push(...collectFilesByExt(full, exts));
    } else if (
      entry.isFile() &&
      exts.some((e) => entry.name.endsWith(e)) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      out.push(full);
    }
  }
  return out;
}

function extractStringLiterals(tsxSource: string): string[] {
  // Crude but effective: grab every double-quote, single-quote, and
  // template-literal span. This is a static guard, not a semantic check —
  // over-grepping is the intent.
  const strings: string[] = [];
  const patterns = [
    /"((?:[^"\\]|\\.)*)"/g,
    /'((?:[^'\\]|\\.)*)'/g,
    /`((?:[^`\\]|\\.)*)`/g,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(tsxSource)) !== null) {
      strings.push(m[1]);
    }
  }
  return strings;
}

interface Hit {
  source: string;
  word: string;
  context: string;
}

function scanJsonFile(file: string, relLabel: string): Hit[] {
  const hits: Hit[] = [];
  const raw = fs.readFileSync(file, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return hits;
  }
  const walk = (node: unknown, keyPath: string): void => {
    if (typeof node === 'string') {
      for (const word of BANNED) {
        if (bannedRegex(word).test(node)) {
          hits.push({ source: `${relLabel}:${keyPath}`, word, context: node });
        }
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, keyPath ? `${keyPath}.${k}` : k);
      }
    }
  };
  walk(parsed, '');
  return hits;
}

function scanTsxFile(file: string, relLabel: string): Hit[] {
  const hits: Hit[] = [];
  const raw = fs.readFileSync(file, 'utf-8');
  const strings = extractStringLiterals(raw);
  for (const s of strings) {
    // Skip import paths & tailwind utility strings — look for prose only.
    // If a word is banned and appears, report it with the raw string.
    for (const word of BANNED) {
      if (bannedRegex(word).test(s)) {
        hits.push({ source: relLabel, word, context: s });
      }
    }
  }
  return hits;
}

describe('Banned vocabulary — Recon user-facing surfaces', () => {
  it('ships no banned terms in any recon translation JSON', () => {
    const langs = fs.existsSync(LOCALES_DIR) ? fs.readdirSync(LOCALES_DIR) : [];
    expect(langs.length).toBeGreaterThan(0);

    const allHits: Hit[] = [];
    for (const lang of langs) {
      const reconJson = path.join(LOCALES_DIR, lang, 'recon.json');
      if (fs.existsSync(reconJson)) {
        allHits.push(...scanJsonFile(reconJson, `locales/${lang}/recon.json`));
      }
    }

    if (allHits.length > 0) {
      const report = allHits
        .map((h) => `  ${h.source}: "${h.word}" → ${JSON.stringify(h.context)}`)
        .join('\n');
      expect.fail(
        `Found ${allHits.length} banned term(s) in recon translations:\n${report}\n\n` +
          'See .claude/rules/recon-safety.md §6',
      );
    }
  });

  it('has no banned terms in any landing-page translation (recon feature section keys)', () => {
    const langs = fs.existsSync(LOCALES_DIR) ? fs.readdirSync(LOCALES_DIR) : [];
    const allHits: Hit[] = [];
    for (const lang of langs) {
      const landingJson = path.join(LOCALES_DIR, lang, 'landing.json');
      if (!fs.existsSync(landingJson)) continue;
      try {
        const json = JSON.parse(fs.readFileSync(landingJson, 'utf-8')) as Record<
          string,
          unknown
        >;
        // Only audit the recon-related subtree if present.
        const candidates: Array<[string, unknown]> = [];
        for (const [k, v] of Object.entries(json)) {
          if (k.toLowerCase().includes('recon')) candidates.push([k, v]);
        }
        const walk = (node: unknown, keyPath: string): void => {
          if (typeof node === 'string') {
            for (const word of BANNED) {
              if (bannedRegex(word).test(node)) {
                allHits.push({
                  source: `locales/${lang}/landing.json:${keyPath}`,
                  word,
                  context: node,
                });
              }
            }
            return;
          }
          if (node && typeof node === 'object') {
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
              walk(v, keyPath ? `${keyPath}.${k}` : k);
            }
          }
        };
        for (const [k, v] of candidates) walk(v, k);
      } catch {
        // Malformed JSON — the i18n-completeness test will catch that.
      }
    }

    if (allHits.length > 0) {
      const report = allHits
        .map((h) => `  ${h.source}: "${h.word}" → ${JSON.stringify(h.context)}`)
        .join('\n');
      expect.fail(
        `Found ${allHits.length} banned term(s) in landing recon subtree:\n${report}`,
      );
    }
  });

  it('has no banned terms in Recon TSX source (pages + components + landing + settings)', () => {
    const files: Array<[string, string]> = [];
    for (const f of collectFilesByExt(COMPONENTS_RECON, ['.tsx'])) {
      files.push([f, path.relative(FRONTEND, f)]);
    }
    for (const f of collectFilesByExt(PAGES_RECON, ['.tsx'])) {
      files.push([f, path.relative(FRONTEND, f)]);
    }
    if (fs.existsSync(LANDING_SECTION)) {
      files.push([LANDING_SECTION, path.relative(FRONTEND, LANDING_SECTION)]);
    }
    if (fs.existsSync(SETTINGS_TAB)) {
      files.push([SETTINGS_TAB, path.relative(FRONTEND, SETTINGS_TAB)]);
    }

    expect(files.length).toBeGreaterThan(0);

    const allHits: Hit[] = [];
    for (const [abs, rel] of files) {
      allHits.push(...scanTsxFile(abs, rel));
    }

    if (allHits.length > 0) {
      const report = allHits
        .map((h) => `  ${h.source}: "${h.word}" → ${JSON.stringify(h.context)}`)
        .join('\n');
      expect.fail(
        `Found ${allHits.length} banned term(s) in Recon TSX source:\n${report}\n\n` +
          'See .claude/rules/recon-safety.md §6',
      );
    }
  });
});
