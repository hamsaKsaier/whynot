# 01 — i18n: English Audit & Canonical Key Extraction

## Agent
`translation-manager`

## Skills referenced
- `.claude/skills/backend-i18n/`
- `.claude/skills/spec-driven-development/`

## Task

The v2 migration prompts (17-20 in `prompts/01-v2-migration/`) claimed i18n was complete, but the language switcher has no effect on the UI because most components still hardcode English strings. Audit must pass before we can translate to the other 4 languages.

**Current state**:
- `frontend/src/i18n.ts` and `admin-frontend/src/i18n.ts` configure i18next with 5 locales and namespaces.
- `LanguageSwitcher.tsx` correctly sets `document.documentElement.dir = "rtl"` for Arabic.
- But `frontend/src/pages/LoginPage.tsx` lines 57, 100, 117, 141, 148 hardcode "Sign in to your account", "Email address", "Password", "Remember me", "Forgot password?" — none of them go through `t()`.
- Similar hardcoding in `SignupPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `SettingsPage` (ProfileTab/OrganizationTab/DangerZoneTab), `QALoopPage`, `QALoop/SessionForm`, and every route under `frontend/src/routes/`.
- Same problem in `admin-frontend/src/pages/*` and `admin-frontend/src/routes/**`.
- Zod validation messages are also hardcoded: `LoginPage.tsx:18` — `"Password must be at least 8 characters"`.

This prompt establishes the **canonical English key tree** by extracting every user-facing string into translation JSON files. The four language prompts (02-05) depend on this.

### Scope / Requirements

1. **Static audit**
   - Use `grep`/AST tooling inside Docker: `make shell-client npx i18next-parser --config ./i18next-parser.config.js` (create the config if missing).
   - Produce a per-file report of hardcoded strings under `frontend/src/**/*.{ts,tsx}`, `admin-frontend/src/**/*.{ts,tsx}`, and shared packages.
   - Classify strings: `UI labels`, `form validation` (zod, react-hook-form), `toast/notification`, `aria-label`, `placeholder`, `title/meta`, `button text`.

2. **Namespace design**
   - Use existing namespaces in `frontend/public/locales/en/`: `common`, `auth`, `dashboard`, `runner`, `results`, `settings`, `billing`, `landing`. Add new ones only if no existing namespace fits.
   - Admin uses: `common`, `admin`, `auth`, `settings`. Add `superadmin` namespace for `/admin-frontend/src/pages/{Users,Organizations,Plans,Subscriptions,Credits,BillingConfig,FeatureFlags,AIProviders,AuditLog,Analytics,UsageTracking,Announcements,SystemSettings}Page.tsx`.
   - Key naming: `camelCase.dotted.paths`, nouns for values, verbs for actions. Example: `auth.login.title`, `auth.login.form.emailLabel`, `auth.login.validation.passwordMinLength`.

3. **Refactor components**
   - Wrap every hardcoded user-facing string in `t('namespace:key')` via `useTranslation()`.
   - For zod schemas, use the pattern `z.string().min(8, { message: t('auth.login.validation.passwordMinLength') })` by creating schemas inside the component (or use a `createLoginSchema(t)` helper pattern).
   - For toast/notification messages (react-hot-toast, sonner), always call `t()` at call time, not at module load.
   - Add a `Trans` component for strings with embedded elements (links, bold).

4. **Populate `en/*.json`**
   - Write complete English values for every key referenced in components.
   - Sort keys alphabetically for diff stability.
   - No trailing commas, UTF-8, LF line endings.

5. **Update tests**
   - `frontend/src/__tests__/i18n-completeness.test.ts` must pass for `en`.
   - Add a new test `i18n-no-hardcoded-strings.test.ts` that scans compiled JSX for string literals in specific props (`children` of `Button`, `Label`, `p`, `h1-h6`, `TabsTrigger`, `CardTitle`, `CardDescription`, `AlertTitle`, `AlertDescription`, `title=`, `placeholder=`, `aria-label=`) and fails if any look like English sentences.

### Tests (MANDATORY — 100% coverage for changes)
- **Unit**: each refactored component renders with `t()` mocked and shows keys (no crash).
- **Integration**: mount each page wrapped in `I18nextProvider` with English bundle; assert visible text matches JSON values.
- **Completeness**: `i18n-completeness.test.ts` checks every key referenced in any `.tsx` file exists in `en/*.json` and vice versa (no dead keys).
- **Linter rule**: add ESLint rule `react/jsx-no-literals` with whitelist for non-text children (numbers, emojis, punctuation) and enforce via `make shell-client npm run lint`.
- **Edge cases**: pluralization (`{count, plural, one {# test} other {# tests}}`), interpolation (`{{userName}}`), nested translation (`Trans` with `<Link>`).

### i18n (MANDATORY — 5 languages)
- Scope of this prompt is **English only** — it defines the canonical key tree.
- Frontend keys added under `frontend/public/locales/en/{common,auth,dashboard,runner,results,settings,billing,landing}.json`.
- Admin keys added under `admin-frontend/public/locales/en/{common,admin,auth,settings,superadmin}.json`.
- Create empty stubs (same key tree, empty string values) for `ar`, `fr`, `de`, `es` in both `frontend/public/locales/` and `admin-frontend/public/locales/` — prompts 02-05 will populate them.
- RTL considerations: for Arabic, every string that contains directional punctuation (`"` `→` `(` `)`) will be reviewed in prompt 02; nothing to do here.

### Documentation
- Create/update `/docs/en/i18n/how-to-add-a-translation-key.md` — walk through the workflow.
- Link from `/docs/en/i18n/index.md` (create if missing).
- Translations of this doc (ar/fr/de/es) are out of scope for this prompt — they're covered in prompts 02-05.

### Constraints
- **Docker-only**: every command must be `make shell-client ...` or `make shell-admin ...`. No direct `npm`/`node` calls.
- Follow `.claude/rules/spec-driven-development.md` and `.claude/rules/rtl-support-arabic.md`.
- No hardcoded hex colors introduced.
- Logical properties only (`ms-*`, `me-*`, `text-start`, `text-end`).
- camelCase API responses preserved; bigint cents for money untouched.

### Verification steps
1. `make shell-client npm run typecheck`
2. `make shell-client npm run lint`
3. `make shell-client npm test -- i18n`
4. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- i18n`
5. Manual: start stack with `make start`, open `http://localhost:5183`, switch language to every locale — English must still render identically, ar/fr/de/es will show keys (expected at this stage).
6. `grep -rEn "(^|>|=\")[A-Z][a-z].*\"" frontend/src admin-frontend/src --include="*.tsx"` should return zero user-facing English literals (excluding test files and `id=` / `data-*` / className).
