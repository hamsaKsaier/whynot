# /docs 5-Language Parity Check

## Agent
`.claude/agents/translation-manager.md` — primary. Owns multilingual documentation parity.

## Skills
`.claude/skills/backend-i18n/` — reference for context around backend-related docs.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Ensure the `/docs/` tree is mirrored across all 5 supported languages (`en`, `ar`, `fr`, `de`, `es`) with identical relative paths and parallel heading structure. Add a parity test that fails CI when the trees diverge.

### 1. Inventory

Walk the current `/docs/` tree and record every relative path under each language folder. Build a table of:
- Paths present in `en/` but missing in `ar/`, `fr/`, `de/`, `es/`.
- Paths present in a non-English folder but missing in `en/` (rare; usually a mistake — consolidate to `en/` as canonical).
- Paths that exist in all 5 but have divergent heading structure (H1/H2/H3 count mismatch).

`en/` is canonical for content; `ar|fr|de|es` mirror it.

### 2. Fill the gaps

For every path present in `en/` but missing in other language folders:
- Create the file at the same relative path under each missing language folder.
- Copy the heading structure from `en/` verbatim (translated).
- Translate the body. If machine translation is used as a first pass, add `draft: true` to YAML frontmatter so human reviewers know to revisit. The parity test accepts `draft: true` as valid.
- Preserve all code blocks, commands, and file paths unchanged — only prose translates.
- Preserve link targets; update anchor text only.

### 3. Files added by prompts 01–05 specifically
These prompts create or extend docs. This prompt must ensure each exists in all 5 languages:
- `/docs/{en,ar,es,fr,de}/testing/performance.md` (from prompt 01).
- `/docs/{en,ar,es,fr,de}/i18n.md` — extended sections for frontend audit (prompt 02), backend audit (prompt 04), and testing harness (prompt 05).
- `/docs/{en,ar,es,fr,de}/admin/i18n.md` (from prompt 03).
- `/docs/{en,ar,es,fr,de}/api/errors.md` (from prompt 04, if gateway responses added this doc).

### 4. Parity test

Create `scripts/docs-parity.test.ts` (or `tests/docs-parity.test.ts` in whichever package runs CI-wide tests — likely `gateway/src/__tests__/` since it's the most stable test runner):

```ts
// Pseudocode
const languages = ['en', 'ar', 'fr', 'de', 'es'] as const;
const root = path.resolve(__dirname, '../../docs');

function collectPaths(lang: string): Set<string> {
  // glob `${root}/${lang}/**/*.md`
  // return Set of paths relative to `${root}/${lang}/`
}

test('docs tree parity across all 5 languages', () => {
  const enPaths = collectPaths('en');
  for (const lang of languages.filter(l => l !== 'en')) {
    const langPaths = collectPaths(lang);
    const missing = [...enPaths].filter(p => !langPaths.has(p));
    const extra = [...langPaths].filter(p => !enPaths.has(p));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  }
});

test('heading structure parity', () => {
  // For each relative path in en/, parse headings (H1/H2/H3).
  // Assert every other language folder has the same heading count at each level.
});
```

Run this test in Docker via `make test` (add to whichever Vitest config the file lives under).

### 5. Frontmatter convention
Every markdown file should have minimal YAML frontmatter:
```yaml
---
title: "<Localized title>"
description: "<Localized one-liner>"
lang: <en|ar|fr|de|es>
draft: false
---
```

`lang` must match the folder. If absent, the parity test auto-derives from the path; if present it must match. `draft` defaults to `false`. The parity test allows `draft: true` without failing (but can warn).

### 6. RTL for Arabic docs
- Arabic markdown files render in a UI that sets `dir="rtl"` per the `/docs/ar/` tree.
- Code blocks stay LTR (standard markdown renderer behavior — no action needed).
- Lists, quotes, and tables flow RTL automatically via the renderer.

### Tests
Docker-only.

- `scripts/docs-parity.test.ts` (or equivalent) — assert tree parity + heading-structure parity across all 5 languages.
- Seeded-regression test: temporarily add a file to `/docs/en/__test__.md`, assert the test fails; remove it, assert the test passes again. (Implement via a fixture flag, not a real file in the tree.)
- Frontmatter validation: every `.md` under `/docs/` parses as valid YAML frontmatter + markdown body; `lang` field (if present) matches folder.
- Coverage: if the parity test lives in a Vitest-covered package, it contributes; 100% thresholds preserved.

### i18n
This prompt *is* the i18n work — translating markdown content across 5 language trees.
- Translation quality: prefer professional translation; accept machine translation as an initial draft marked `draft: true`.
- Technical terminology: keep unchanged where it's a product / library / tool name (Docker, Recharts, TanStack Router, i18next, Vitest, Playwright, Stripe, Postgres, etc.).

### Documentation
This prompt is the documentation prompt. No further meta-doc needed beyond the parity test itself.

### Verification

```bash
make test                           # includes docs-parity.test.ts
# spot check:
ls docs/en docs/ar docs/fr docs/de docs/es
```

Acceptance criteria:
- [ ] Every `.md` file under `/docs/en/` has counterparts at the same relative path under `/docs/{ar,fr,de,es}/`.
- [ ] Headings align across all 5 languages per file.
- [ ] New files from prompts 01–05 exist in all 5 language trees.
- [ ] `docs-parity.test.ts` passes and fails loudly when seeded regressions are introduced.
- [ ] All frontmatter has correct `lang` field matching its folder.
- [ ] Machine-translated drafts are flagged `draft: true` for human review.
