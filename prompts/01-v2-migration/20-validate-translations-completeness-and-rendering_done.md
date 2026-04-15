# Validate: Translations are complete, rendered, and visually correct

## Agent
`translation-manager` (verifier) + `design-ui-designer`

## Depends on
`19-translate-all-strings-5-languages.md`

## Goal
Verify all 5 languages render correctly across every Shadcn-rewritten page in both apps and the gateway, with no missing keys, no fallback English in non-English locales, and no layout breakage in long-string or RTL contexts.

## Validation steps

### 1. Static checks
- `bun typecheck`, `bun lint` → exit 0 in all packages

### 2. Strengthened completeness tests
- Run the completeness tests in all 3 surfaces.
- Assert: zero keys missing, zero values equal to English (outside brand glossary), plural variants present.

### 3. Visual smoke per language
- Playwright `frontend`: navigate to every rewritten page (auth, dashboard, runner, results) in each of en/ar/fr/de/es and capture full-page screenshots in light + dark.
- Playwright `admin-frontend`: same for every admin page.
- Compare against baseline (first run sets baseline). Tolerance documented in `docs/i18n.md`.

### 4. RTL correctness
- For every Arabic screenshot: assert no overflow, icons mirrored correctly via logical properties, no left/right hardcoded margins/paddings leaking through.
- Visual diff inspector flags any layout breakage explicitly.

### 5. Backend localization smoke
- Supertest hits 10 representative endpoints with each `Accept-Language`. Assert response messages are the exact translations from the JSON files (no fallback strings).

### 6. A11y in every language
- Axe scan on at least one page per language. Same a11y score across languages.

### 7. Regression scan
- All earlier-phase tests still green. Coverage unchanged or up.

## Pass criteria
- [ ] Completeness test passes (5 languages × all surfaces).
- [ ] No fallback English in non-English UI screenshots (manual review or OCR diff).
- [ ] RTL screenshots show no layout breakage.
- [ ] Backend returns correct localized messages for all 5 languages.
- [ ] Axe passes per language.
- [ ] No regressions.

## On failure
- Re-open `19-translate-all-strings-5-languages.md`; fix; rerun this validation.
- Do NOT advance to phase 5 until this validation passes.
