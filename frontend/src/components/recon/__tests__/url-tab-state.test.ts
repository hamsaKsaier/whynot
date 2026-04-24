import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * URL tab-state regression — Recon + settings.
 *
 * This repo uses react-router-dom (v6), so the "TanStack Router
 * validateSearch" pattern from `.claude/rules/url-tab-state.md` does not
 * apply literally. The functionally-equivalent pattern here is:
 *
 *   - The page imports `useSearchParams` from 'react-router-dom'.
 *   - The page reads `?tab=...` from the query string.
 *   - The page writes the tab change back via `setSearchParams`.
 *
 * This static assertion is paired with the per-page behavioural tests
 * (ReconScansListPage / ReconScanDetailPage) that render, click a tab,
 * and verify the URL updates.
 *
 * Covered pages:
 *   - D2 list:     pages/recon/ReconScansListPage.tsx
 *   - D4 detail:   pages/recon/ReconScanDetailPage.tsx
 *   - D6 settings: pages/SettingsPage.tsx (parent of ReconSettingsTab)
 */

const FRONTEND_SRC = path.resolve(__dirname, '../../..');

const TABBED_PAGES = [
  path.join(FRONTEND_SRC, 'pages', 'recon', 'ReconScansListPage.tsx'),
  path.join(FRONTEND_SRC, 'pages', 'recon', 'ReconScanDetailPage.tsx'),
  path.join(FRONTEND_SRC, 'pages', 'SettingsPage.tsx'),
];

interface Check {
  file: string;
  passes: boolean;
  reason: string;
}

function checkPage(file: string): Check[] {
  const rel = path.relative(FRONTEND_SRC, file);
  if (!fs.existsSync(file)) {
    return [{ file: rel, passes: false, reason: 'file does not exist' }];
  }
  const src = fs.readFileSync(file, 'utf-8');

  const out: Check[] = [];

  const importsHook = /from\s+['"]react-router-dom['"]/.test(src) &&
    /useSearchParams/.test(src);
  out.push({
    file: rel,
    passes: importsHook,
    reason: 'imports useSearchParams from react-router-dom',
  });

  const readsTabParam = /searchParams\.get\(\s*['"]tab['"]\s*\)/.test(src);
  out.push({
    file: rel,
    passes: readsTabParam,
    reason: 'reads searchParams.get("tab") for initial tab state',
  });

  // Tab changes must write back. Accept any of the three common patterns:
  //   setSearchParams({ tab })                             (SettingsPage)
  //   setSearchParams(newParams) after params.set("tab")   (list page)
  //   updateSearch((p) => p.set("tab", next)) helper       (detail page)
  const usesSetSearchParams = /setSearchParams\s*\(/.test(src);
  const mutatesTabKey = /\.set\(\s*['"]tab['"]/.test(src) ||
    /setSearchParams\(\s*\{[^}]*\btab\b[^}]*\}/s.test(src);
  const writesTabParam = usesSetSearchParams && mutatesTabKey;
  out.push({
    file: rel,
    passes: writesTabParam,
    reason: 'writes the active tab back to the URL via setSearchParams',
  });

  return out;
}

describe('URL tab-state regression — Recon + Settings', () => {
  for (const file of TABBED_PAGES) {
    const rel = path.relative(FRONTEND_SRC, file);
    describe(rel, () => {
      const checks = checkPage(file);
      for (const c of checks) {
        it(c.reason, () => {
          if (!c.passes) {
            expect.fail(
              `URL tab-state rule violated in ${c.file}: FAILED — ${c.reason}.\n` +
                'See .claude/rules/url-tab-state.md (adapted to react-router-dom).',
            );
          }
          expect(c.passes).toBe(true);
        });
      }
    });
  }
});
