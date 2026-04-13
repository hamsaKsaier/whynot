# Translate every string into all 5 languages

## Agent
`translation-manager` (lead) + `backend-i18n-developer` + skill `backend-i18n`

## Depends on
`18-validate-i18n-infrastructure.md`

## Goal
Replace every English placeholder under `ar/`, `fr/`, `de/`, `es/` (frontends + gateway) with high-quality, contextually-correct translations. The infrastructure from prompt 17 is already in place; this prompt is purely content.

## Single source of truth
`ARCHITECTURE.md` section 14.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Extract every English string
- Walk `frontend/public/locales/en/*.json`, `admin-frontend/public/locales/en/*.json`, `gateway/src/i18n/translations/en/*.json`.
- For each file, build a flattened key/value list to translate.

### 2. Translate per language
- For **ar, fr, de, es**: produce native, idiomatic translations preserving:
  - Placeholders like `{{count}}`, `{{userName}}`, `{{plan}}`.
  - HTML/JSX tags inside strings (e.g. `<bold>`, `<link>`).
  - Pluralization rules (use i18next's `_one`, `_other`, `_zero`, `_two`, `_few`, `_many` keys where applicable — Arabic in particular requires the full plural set).
- Maintain UI tone: brand voice for marketing strings, terse for system messages, formal for legal/billing.
- Arabic translations must read right-to-left and use Arabic numerals where culturally appropriate (configurable per key).

### 3. Brand glossary
- Create `docs/i18n/glossary.md` listing every product term that must NOT be translated (brand name `whynot`, `QA Loop`, `MCP`, etc.) and its accepted form per language.
- Translation must respect this glossary.

### 4. Pluralization audit
- Identify every English key that uses interpolated counts; ensure each language has the appropriate plural variants.

### 5. Strengthen completeness tests
Update the completeness tests created in prompt 17 to additionally assert:
- For every key in `en`, the same key in each of `ar`, `fr`, `de`, `es` is **non-empty** AND **not equal to the English value** (with allow-list exceptions for brand-glossary terms).
- Plural variants are present where required.

### 6. Update gateway error/email/billing strings
- All keys in `gateway/src/i18n/translations/{ar,fr,de,es}/{errors,success,emails,validation,billing}.json` filled.

### Files to create/modify
- `frontend/public/locales/{ar,fr,de,es}/*.json` — all 32 files content-filled
- `admin-frontend/public/locales/{ar,fr,de,es}/*.json` — all 16 files content-filled
- `gateway/src/i18n/translations/{ar,fr,de,es}/*.json` — all 20 files content-filled
- `docs/i18n/glossary.md` — new
- `frontend/src/__tests__/i18n-completeness.test.ts`, `admin-frontend/src/__tests__/i18n-completeness.test.ts`, `gateway/src/__tests__/i18n-completeness.test.ts` — strengthened

### Tests
- Strengthened completeness test passes for all 5 languages.
- A "no English in non-English locales" sweep test (with brand-glossary allow-list) passes.
- Plural-variant test: pick 5 keys with interpolation; assert plural forms exist per language.

### i18n
- This prompt **is** the i18n content delivery for the project.

### Documentation
- `docs/i18n/glossary.md` — created
- `docs/i18n.md` — append a "Translation update process" section (5 languages: en, ar, fr, de, es)

### Acceptance criteria
- [ ] Every English key has a non-empty, distinct, idiomatic translation in ar/fr/de/es.
- [ ] Brand glossary respected.
- [ ] Pluralization handled (especially Arabic).
- [ ] Strengthened completeness test passes.
- [ ] Coverage unchanged or increased.
- [ ] No regressions.
