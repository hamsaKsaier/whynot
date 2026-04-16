# 05 — i18n: Spanish (es) Translations

## Agent
`translation-manager`

## Skills referenced
- `.claude/skills/backend-i18n/`

## Task

Populate all Spanish translation JSON files for `frontend/` and `admin-frontend/`, matching the canonical English key tree from prompt 01.

**Register**: Neutral Latin American Spanish (español neutro) suitable for global SaaS. Use "usted" form for formality. Avoid region-specific slang (no "vos", no Spain-only terms like "ordenador" — prefer "computadora"). When a term splits across regions, pick the Latin American variant.

### Scope / Requirements

1. **Translate all frontend keys**
   - Under `frontend/public/locales/es/{common,auth,dashboard,runner,results,settings,billing,landing}.json`.
   - Preserve keys, placeholders, plural categories (`one`, `other`).

2. **Translate all admin-frontend keys**
   - Under `admin-frontend/public/locales/es/{common,admin,auth,settings,superadmin}.json`.

3. **Typographic & grammatical conventions**
   - Inverted punctuation: `¿Olvidó su contraseña?`, `¡Éxito!`.
   - Accented characters (`á`, `é`, `í`, `ó`, `ú`, `ñ`, `¿`, `¡`) — ensure UTF-8 is preserved through the build.
   - Capitalize only the first word of sentences and proper nouns, never English title case.

4. **Locale-aware formatting**
   - Dates via `Intl.DateTimeFormat("es-419", ...)` (Latin America) — e.g. `15 de abril de 2026`.
   - Numbers: region varies. Use `es-419` default (thousands `,`, decimal `.`) — i.e. `1,234.56`. If the product prefers European Spanish format (`1.234,56`), document the decision in the PR.
   - Currency: `$1,234.56` or `1.234,56 €` per the user's org currency.

5. **Terminology glossary**
   - `Test run` → `Ejecución de prueba`, `Flaky test` → `Prueba inestable`, `Dashboard` → `Panel` (or `Tablero`), `Sign in` → `Iniciar sesión`, `Sign up` → `Registrarse`, `Settings` → `Configuración`, `Billing` → `Facturación`, `API key` → `Clave de API`.

### Tests (MANDATORY — 100% coverage)
- **Completeness**: `i18n-completeness.test.ts` passes for `es`.
- **Render test**: mount each page with `i18next` set to `es`; assert Spanish characteristic markers (`ñ`, `¿`, `¡`, common articles `el`, `la`, `los`, `las`) in visible text.
- **Inverted punctuation check**: custom test scans question/exclamation strings and asserts matching `¿`/`?` and `¡`/`!` pairs.
- **Plural rendering**: 0, 1, 2.
- **No `undefined` fallthrough**.

### i18n (this prompt's scope — Spanish)
- `frontend/public/locales/es/*.json` — full coverage.
- `admin-frontend/public/locales/es/*.json` — full coverage.
- Backend Spanish JSON is scope of prompt 06.

### Documentation
- `/docs/es/i18n/how-to-add-a-translation-key.md`
- `/docs/es/index.md`

### Constraints
- Docker-only: `make shell-client`, `make shell-admin`.
- Prefer "usted" over "tú" for formality.
- Never translate placeholder variable names or component tags.
- Preserve STYLES.md rules.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test -- i18n`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- i18n`
3. `make start` → switch to Spanish at `http://localhost:5183`, verify:
   - Every visible string in Spanish
   - Inverted punctuation renders correctly
   - Dates/numbers format per chosen locale
   - Backend errors in Spanish (after prompt 06 lands)
4. Same check on `http://localhost:5184`.
