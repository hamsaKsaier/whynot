# 03 — i18n: French (fr) Translations

## Agent
`translation-manager`

## Skills referenced
- `.claude/skills/backend-i18n/`

## Task

Populate all French translation JSON files for `frontend/` and `admin-frontend/`, matching the canonical English key tree produced in prompt 01. Current French files are stubs.

**Register**: Formal French (vouvoiement), suitable for B2B SaaS. Use standard French terminology (France-French), not Québécois, unless a term is ambiguous. Use inclusive writing (e.g. "l'utilisateur ou l'utilisatrice") sparingly — prefer neutral nouns ("personne utilisatrice" is OK for headings but wordy for buttons).

### Scope / Requirements

1. **Translate all frontend keys**
   - For every key under `frontend/public/locales/en/{common,auth,dashboard,runner,results,settings,billing,landing}.json`, produce a French value in `frontend/public/locales/fr/<same-file>.json`.
   - Preserve key structure, placeholder syntax (`{{var}}`, `{count, plural, one {…} other {…}}`), and HTML-ish interpolation tags (`<0>`, `<1>`).
   - French plural categories: `one`, `other`. Use `other` for 0 and ≥2.

2. **Translate all admin-frontend keys**
   - Same treatment for `admin-frontend/public/locales/en/{common,admin,auth,settings,superadmin}.json` → `admin-frontend/public/locales/fr/*.json`.

3. **Typography**
   - Use French typographic conventions: non-breaking space before `:`, `;`, `?`, `!`, `»`; thin space inside `« »` quotes.
   - Use straight quotes only if `«` `»` are not supported in a given UI context; default to `«&nbsp;…&nbsp;»`.
   - Capitalize only the first word of sentences and proper nouns; do NOT use English title case for headings.

4. **Locale-aware formatting**
   - Dates: `Intl.DateTimeFormat("fr-FR", ...)` — e.g. `15 avril 2026`.
   - Numbers: thousands separator is non-breaking space; decimal is comma (`1 234,56`).
   - Currency: respect org currency; format as `1 234,56 €` or `1 234,56 US$`.

5. **Terminology consistency**
   - Build a short glossary at the top of the PR: e.g. `Test run` → `Exécution de test`, `Flaky test` → `Test instable`, `Dashboard` → `Tableau de bord`, `Sign in` → `Se connecter`, `Sign up` → `Créer un compte`, `Settings` → `Paramètres`, `Billing` → `Facturation`, `API key` → `Clé d'API`.
   - Stick to the glossary throughout.

### Tests (MANDATORY — 100% coverage)
- **Completeness**: `i18n-completeness.test.ts` passes for `fr` — every en key has a non-empty fr value, and no fr value equals the en value (except whitelisted proper nouns).
- **Render test**: mount each page with `i18next` set to `fr`; assert at least one French-characteristic marker (accented char, French article like `le`, `la`, `des`) in visible text.
- **Typographic spacing**: custom test that scans fr JSON for `:`, `;`, `?`, `!` and asserts they're preceded by `\u00A0` (NBSP) or `\u202F` (NNBSP) — fail with the offending key path.
- **Plural rendering**: assert `{count, plural, one {…} other {…}}` keys render correctly for 0, 1, 2 in French.
- **No `undefined` fallthrough**: render all tree nodes of each page in `fr` and assert no `[undefined]`, `[object Object]`, or English sentences appear.

### i18n (this prompt's scope — French)
- `frontend/public/locales/fr/*.json` — full coverage.
- `admin-frontend/public/locales/fr/*.json` — full coverage.
- Backend French JSON is out of scope here; prompt 06 covers it.

### Documentation
- `/docs/fr/i18n/how-to-add-a-translation-key.md`
- `/docs/fr/index.md`

### Constraints
- Docker-only: `make shell-client`, `make shell-admin`.
- Never machine-translate without review. Document which human reviewer validated the output.
- Preserve placeholders exactly; never translate `{{variable}}` names or component tags.
- Respect STYLES.md — no style or markup drift.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test -- i18n`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- i18n`
3. `make start` → open `http://localhost:5183`, switch to French, verify:
   - Every visible string renders in French
   - Dates and numbers format per `fr-FR`
   - French typographic spacing present where expected
   - Backend error messages render in French (after prompt 06 lands)
4. Same check on `http://localhost:5184`.
