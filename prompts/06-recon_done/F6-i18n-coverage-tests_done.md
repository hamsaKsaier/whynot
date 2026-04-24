# Recon — i18n coverage & banned-vocabulary CI gate

## Agent
`translation-manager` (`.claude/agents/translation-manager.md`).

## Skills
- Primary: `.claude/skills/backend-i18n/`
- Rules: `.claude/rules/rtl-support-arabic.md`, `.claude/rules/recon-safety.md` (A7)

## Dependencies
- All Recon i18n keys added across B–E.

## Task
Lock down 5-language coverage for Recon and prevent banned-vocabulary regressions in any locale file.

### 1. Coverage gate
A new CI test (`scripts/i18n-recon-coverage.test.ts` or wherever the project runs i18n tests):
- Define the canonical key list for Recon by parsing the English source files:
  - `frontend/public/locales/en/recon.json`
  - `frontend/public/locales/en/common.json` (filter for `common.nav.recon` + nested)
  - `frontend/public/locales/en/landing.json` (filter for `landing.recon.*` + `landing.pricing.recon.*`)
  - `frontend/public/locales/en/settings.json` (filter for `settings.recon.*`)
  - `gateway/src/i18n/translations/en/{errors,success,validation,billing}.json` (filter for keys starting with `recon.` or containing `recon`)
- For each of `ar`, `fr`, `de`, `es`, assert every key from the English source exists in the corresponding locale file with a non-empty string value.
- Assert no extra Recon keys exist in non-English locales (catches typos in translated keys).

### 2. Banned-vocabulary gate
A new CI test that scans every locale JSON value (frontend + gateway) for any of the banned strings (case-insensitive):
- Shannon
- KeygraphHQ
- nmap
- subfinder
- whatweb
- schemathesis
- Playwright
- Anthropic
- Claude

A match in ANY locale fails the build. Provides a clear error message listing the offending file + key + value.

### 3. Banned-vocabulary gate — docs
The same test extended to scan `/docs/recon/**` markdown for the same strings (E3).

### 4. RTL sanity check
A spot-check test for Arabic: render 5 randomly-chosen Recon UI strings in `<div dir="rtl">`; assert no fixed `direction: ltr` style leaks (catches stray `dir="ltr"` in component code that would override RTL on translated content).

### 5. Translation-manager handoff
The agent body for `translation-manager.md` (existing) instructs translators to:
- Translate, don't transliterate (except brand names and tool labels per local norms).
- Preserve placeholder syntax (`{{variable}}`).
- Match the punctuation convention of the target language.
- Verify Arabic text reads right-to-left in the rendered UI.

### Tests
- The two CI gates above ARE the tests.
- Add a passing/failing fixture: a temporary locale file with a missing key + a banned word; assert the gate fails on it; remove the fixture.

### i18n
- This prompt verifies i18n; doesn't add new keys.

### Documentation
- N/A.

### Files to modify
- New test files (location depends on project's test conventions — likely under `scripts/` or `frontend/src/__tests__/`).
- CI config (e.g. `.github/workflows/*.yml`) to wire the test into the required-checks list.
