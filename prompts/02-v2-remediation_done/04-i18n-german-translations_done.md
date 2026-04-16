# 04 — i18n: German (de) Translations

## Agent
`translation-manager`

## Skills referenced
- `.claude/skills/backend-i18n/`

## Task

Populate all German translation JSON files for `frontend/` and `admin-frontend/`, matching the canonical English key tree from prompt 01.

**Register**: Formal German using the "Sie" form throughout (never "du"). Standard High German (Standarddeutsch), not Swiss or Austrian variants. Capitalize nouns per German orthography.

### Scope / Requirements

1. **Translate all frontend keys**
   - Under `frontend/public/locales/de/{common,auth,dashboard,runner,results,settings,billing,landing}.json`.
   - Preserve keys, placeholders, plural categories (`one`, `other` — German uses `other` for 0 and ≥2).
   - All common nouns capitalized.

2. **Translate all admin-frontend keys**
   - Under `admin-frontend/public/locales/de/{common,admin,auth,settings,superadmin}.json`.

3. **Compound words & length**
   - German compounds can be long. Avoid ≥30-character single words in button labels — prefer short verbs. Example: `"Benutzerverwaltung"` is OK for a page title but use `"Benutzer"` for a tab label if space is tight.
   - Verify no truncation occurs on mobile viewports (320px wide). This interacts with prompt 16 (admin responsive) — flag any component where a German string overflows its container.

4. **Locale-aware formatting**
   - Dates via `Intl.DateTimeFormat("de-DE", ...)` — e.g. `15. April 2026`.
   - Numbers: thousands separator `.`, decimal `,` (`1.234,56`).
   - Currency: `1.234,56 €` or `1.234,56 $`.

5. **Terminology glossary**
   - `Test run` → `Testlauf`, `Flaky test` → `Instabiler Test`, `Dashboard` → `Übersicht` (or `Dashboard` — pick one and stick to it; prefer `Übersicht` for localization purists, `Dashboard` is acceptable loan word), `Sign in` → `Anmelden`, `Sign up` → `Registrieren`, `Settings` → `Einstellungen`, `Billing` → `Abrechnung`, `API key` → `API-Schlüssel`.
   - Document the chosen glossary in the PR.

### Tests (MANDATORY — 100% coverage)
- **Completeness**: `i18n-completeness.test.ts` passes for `de`.
- **Render test**: mount each page with `i18next` set to `de`; assert German characteristic markers (`ä`, `ö`, `ü`, `ß`, or common German words `der`, `die`, `das`, `und`, `Sie`) in visible text.
- **Noun capitalization check**: lightweight linter that scans `de/*.json` for lowercased common nouns in heading values. Use a whitelist for proper English loan words (`Dashboard`, `Webhook`, `API`, `URL`).
- **Overflow test**: Playwright runs each page at `375x667` (iPhone SE) with `lang=de` and asserts no element has `scrollWidth > clientWidth` for text-containing nodes. Report overflows as failures.
- **Plural rendering**: assert `{count, plural, one {…} other {…}}` renders for 0, 1, 2.

### i18n (this prompt's scope — German)
- `frontend/public/locales/de/*.json` — full coverage.
- `admin-frontend/public/locales/de/*.json` — full coverage.
- Backend German JSON is scope of prompt 06.

### Documentation
- `/docs/de/i18n/how-to-add-a-translation-key.md`
- `/docs/de/index.md`

### Constraints
- Docker-only: `make shell-client`, `make shell-admin`.
- Always use "Sie" form, never "du".
- Never translate placeholder variable names or component tags.
- Preserve STYLES.md rules.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test -- i18n`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- i18n`
3. `make start` → switch to German at `http://localhost:5183`, verify:
   - Every visible string in German
   - Dates/numbers format per `de-DE`
   - No text overflows on mobile viewport
   - Backend errors in German (after prompt 06 lands)
4. Same check on `http://localhost:5184`.
