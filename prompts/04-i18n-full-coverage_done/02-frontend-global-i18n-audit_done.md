# Frontend Global i18n Audit & Remediation

## Agent
`.claude/agents/translation-manager.md` — owns the audit pass and key naming.
`.claude/agents/frontend-developer.md` — handles React remediation.

## Skills
`.claude/rules/rtl-support-arabic.md` — must stay compliant.
`.claude/rules/uncodixify-ui.md` — visual styling unaffected.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Sweep the entire `frontend/` package (user-facing app, not admin) for hardcoded English strings and bring every user-visible text under i18next. This is the companion to prompt `01-performance-page-i18n-fix.md` — that one fixes the performance page; this one ensures every *other* page is equally complete in `en`, `ar`, `fr`, `de`, `es`.

### 1. Discovery
- Start by running the existing `frontend/src/__tests__/i18n-no-hardcoded-strings.test.ts` and recording every failure. The scanner already understands `<Button>`, `<Label>`, `<CardTitle>`, heading tags, etc., and respects a brand allowlist.
- Expand the scanner's file-include glob to cover **every** file under `frontend/src/**/*.{ts,tsx}` except `*.test.*`, `*.d.ts`, and `__mocks__/`.
- Treat toast messages (`toast.error(...)`, `toast.success(...)`), zod error messages, `aria-label`, `placeholder`, `title`, and `alt` props as user-visible. Extend the scanner to flag these if not already covered.

### 2. Pages to audit (every route in `frontend/src/App.tsx`)
Public routes:
- `/` (HomePage / landing)
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/auth/callback`
- `/scan/:sessionId`

Protected routes:
- `/app` (dashboard home)
- `/qa-loop`
- `/projects`
- `/projects/:id`
- `/test-results`
- `/test-runs/:executionId`
- `/settings`
- `/monitors`
- `/performance` — covered by prompt 01, but the global page-level test must still include it.
- `/checkout`
- `/architecture-flow`

For each page, walk every component it renders (including shared layout, header, sidebar, modals) and convert any hardcoded English to `t('<namespace>:<key>')`. Use existing namespaces before adding new ones: `common`, `auth`, `dashboard`, `runner`, `results`, `settings`, `billing`, `landing`.

### 3. Key-naming conventions
- Namespace by feature domain (not by page): `auth:login.*`, `dashboard:projects.*`, `settings:profile.*`.
- Use `common:` only for strings reused across 3+ features (e.g., `common:actions.{save,cancel,delete,confirm}`, `common:status.{loading,error,retry}`).
- Plurals: use i18next `{{count}}` + `_plural` (and `_zero`, `_few`, `_many` for Arabic).
- Interpolation: consistent camelCase placeholders (`{{userName}}`, not `{{user_name}}`).

### 4. Translation files
Add new keys to all 5 files per namespace:
- `frontend/public/locales/{en,ar,fr,de,es}/common.json`
- `frontend/public/locales/{en,ar,fr,de,es}/auth.json`
- `frontend/public/locales/{en,ar,fr,de,es}/dashboard.json`
- `frontend/public/locales/{en,ar,fr,de,es}/runner.json`
- `frontend/public/locales/{en,ar,fr,de,es}/results.json`
- `frontend/public/locales/{en,ar,fr,de,es}/settings.json`
- `frontend/public/locales/{en,ar,fr,de,es}/billing.json`
- `frontend/public/locales/{en,ar,fr,de,es}/landing.json`

Respect quality rules already enforced by `i18n-completeness.test.ts`:
- French NBSP before `:`, `!`, `?`, `;`.
- Spanish `¿…?` and `¡…!` pairs.
- German language-marker expectations.
- Placeholder parity across all 5 files (same set of `{{vars}}` everywhere).

### 5. Special surfaces
- **zod schemas**: replace inline `z.string().min(3, "Must be at least 3 chars")` with either `z.string().min(3, t('validation:minLength', { min: 3 }))` (if schemas are built inside components) or pass `t` via a factory (`buildLoginSchema(t)`). Prefer the factory pattern so schemas stay locale-aware.
- **Toast messages**: all `toast.*` calls → `t('common:toasts.*')`.
- **`aria-label`**: every icon-only button gets `aria-label={t('common:aria.*')}`.
- **Form placeholders** and **`<option>` labels**: localize all.
- **Date / number formatting**: use `i18n.language` — never hardcode `'en-US'`.
- **Currency formatting**: use `Intl.NumberFormat(i18n.language, { style: 'currency', currency })`. Cents-as-bigint contract is preserved — just the display layer changes.

### Tests
Docker-only: `make test-frontend`.

- Extend `frontend/src/__tests__/i18n-no-hardcoded-strings.test.ts` include glob to cover `src/**/*.{ts,tsx}`. The test must fail if any new hardcoded string is introduced.
- Extend `frontend/src/__tests__/i18n-completeness.test.ts` so every key added in this prompt is asserted present in all 5 language files.
- Per-feature smoke tests (one per protected page + auth flow): mount the page under `en`, `ar`, `fr`, `de`, `es` and assert:
  - No element contains a 4+ character Latin-only run outside the brand allowlist.
  - `document.documentElement.lang` matches the active locale.
  - `document.documentElement.dir` is `rtl` for `ar`, `ltr` otherwise.
- Zod factory tests: build schema under each locale, submit invalid data, assert the error message is localized.
- Coverage threshold stays at 100%.

### i18n
- Existing and new keys across all 8 namespaces × 5 languages.
- RTL: every flex layout must rely on native `dir="rtl"` (no `rtl:flex-row-reverse` per `.claude/rules/rtl-support-arabic.md`). Every directional icon must carry `rtl:scale-x-[-1]` (see `@/lib/rtl`'s `MIRROR_ICONS`).
- Logical properties only — no `ml-*`, `mr-*`, `pl-*`, `pr-*`.
- Any toast / backend error message that has a server-side equivalent must share the key structure with `gateway/src/i18n/translations/*/errors.json` (see prompt 04).

### Documentation
For each of the 5 languages:
- `/docs/{en,ar,es,fr,de}/i18n.md` — expand the "Adding a new user-facing string" section with:
  - Which namespace to pick (decision tree).
  - Placeholder naming rules.
  - How to handle plurals.
  - How to run `make rtl-check` and `make test-frontend`.
- `/docs/{en,ar,es,fr,de}/contributing.md` (if present) — note that new PRs must keep `i18n-no-hardcoded-strings.test.ts` green.

### Verification

```bash
make shell-client npm run lint
make shell-client npm run typecheck
make test-frontend
make rtl-check
make test-e2e           # language-switcher.spec.ts still green
```

Acceptance criteria:
- [ ] `i18n-no-hardcoded-strings.test.ts` passes with the expanded scanner glob.
- [ ] `i18n-completeness.test.ts` passes with every new key present in all 5 languages.
- [ ] Per-page smoke tests pass in all 5 languages (see prompt 05).
- [ ] 100% Vitest coverage preserved.
- [ ] `/docs/{en,ar,es,fr,de}/i18n.md` updated in every language.
