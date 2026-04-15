# Rewrite `frontend/` shell + auth pages in Shadcn

## Agent
`design-ui-designer` (lead) + `design-ux-architect` (IA consult) + skill `shadcn-design-system-compliance`

## Depends on
`08-validate-design-system-foundation.md`

## Goal
Rewrite the app shell (root layout, header/nav/sidebar, footer) and every authentication-related page in `frontend/src/` using the Shadcn primitives installed in prompt 07. Delete the legacy custom components that these screens replace. All new screens must be mobile-first, dark-mode ready, and RTL-aware via logical Tailwind properties.

## Reference
- `ARCHITECTURE.md` sections 7, 13, 14, 17.
- `STYLES.md` (tokens).
- Current files to replace:
  - `frontend/src/App.tsx` (root)
  - Any current `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Footer.tsx` under `frontend/src/components/`.
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/pages/SignupPage.tsx` (if exists) or register flow
  - `frontend/src/pages/ForgotPasswordPage.tsx`
  - `frontend/src/pages/ResetPasswordPage.tsx`
  - `frontend/src/pages/VerifyEmailPage.tsx` (if exists)

The executor must first `ls frontend/src/pages/` and `ls frontend/src/components/` to inventory what actually exists, then map the replacements 1-to-1. For any legacy file that has NO Shadcn replacement target in this prompt (because it's a dashboard/features page), leave it alone — phase 2 covers it in a later prompt.

## Task

### 1. Root layout + routing
Replace `frontend/src/App.tsx` with a Shadcn-based root that wires:
- `ThemeProvider` + `DirectionProvider` (from prompt 07).
- `QueryClientProvider` (react-query) if already used, or install if missing.
- Toast provider: `<Toaster />` from `sonner` (already added in prompt 07).
- Router: whichever the project already uses (TanStack Router or React Router — inspect first; do not switch routers in this prompt).
- Error boundary: new `frontend/src/components/ErrorBoundary.tsx` Shadcn-styled fallback card.

### 2. App shell components
Create:
- `frontend/src/components/layout/AppShell.tsx` — wraps `<main>` with header + sidebar + content + footer slot. Uses Shadcn `Sheet` for mobile sidebar, `NavigationMenu` for desktop.
- `frontend/src/components/layout/Header.tsx` — logo, nav menu (command-K search optional), theme toggle, language switcher placeholder, user dropdown menu (Avatar + DropdownMenu).
- `frontend/src/components/layout/Sidebar.tsx` — collapsible, Shadcn-styled, with icon + label for each section; collapses to icons on `md:` and full on `xl:`; becomes a Sheet on mobile.
- `frontend/src/components/layout/Footer.tsx` — minimal in-app footer (links, version).
- `frontend/src/components/layout/AuthShell.tsx` — centered card layout used by all auth pages (log in, sign up, forgot/reset). Pure-Shadcn `Card` + gradient background matching the light/dark tokens.

### 3. Auth pages
Rewrite each page using `react-hook-form` + `zod` + Shadcn `Form`:

#### `LoginPage.tsx`
Fields: email, password, "remember me" switch, submit button, "forgot password?" link, sign-up link.
Validation: email format, password min 8. Show Shadcn `Alert` on server error.
On success: store JWT via existing auth context (do NOT change the auth state management unless it's already broken), navigate to `/dashboard`.
i18n keys (placeholders for phase 4):
`auth.login.title`, `auth.login.emailLabel`, `auth.login.passwordLabel`, `auth.login.submit`, `auth.login.forgot`, `auth.login.signupPrompt`, `auth.login.rememberMe`, `auth.login.error.invalidCredentials`, `auth.login.error.network`.

#### `SignupPage.tsx`
Fields: name, email, password, confirm password, accept-terms checkbox.
Validation: name required, email format, password strength meter (zxcvbn or custom), confirm matches.
Post-submit: 201 → navigate to `/verify-email`.

#### `ForgotPasswordPage.tsx`
Single email field, submit button, success state.

#### `ResetPasswordPage.tsx`
Reads reset token from URL, two password fields, submit.

#### `VerifyEmailPage.tsx`
Reads token from URL, auto-POSTs on mount, shows "verifying…" → success / failure states.

All pages extend `AuthShell`. All forms use `react-hook-form` + `zodResolver`. All error messages come from `t()` placeholders.

### 4. Delete legacy components cleanly
Before deleting, `grep -r` each legacy file's exported symbol across the app to ensure no stragglers. Then delete. Do NOT keep backwards-compat re-exports. If a legacy component is referenced by a page that hasn't been rewritten yet (phase 2 later prompts), keep the file but mark it with a `// TODO: replaced in prompt NN` comment and update the referencing page in its own prompt.

### 5. Logical Tailwind properties
All `ml-`/`mr-`/`pl-`/`pr-` → `ms-`/`me-`/`ps-`/`pe-`. All `left-`/`right-` → `start-`/`end-`. All `text-left`/`text-right` → `text-start`/`text-end`. Stylelint should flag regressions — if it doesn't, extend the config.

### 6. Update `ARCHITECTURE.md` section 7
Add subsection "App shell" with the component names and their responsibilities.

### Files to create/modify
- `frontend/src/App.tsx` — rewritten.
- `frontend/src/components/layout/AppShell.tsx` — new.
- `frontend/src/components/layout/Header.tsx` — new.
- `frontend/src/components/layout/Sidebar.tsx` — new.
- `frontend/src/components/layout/Footer.tsx` — new.
- `frontend/src/components/layout/AuthShell.tsx` — new.
- `frontend/src/components/ErrorBoundary.tsx` — new.
- `frontend/src/pages/LoginPage.tsx` — rewritten.
- `frontend/src/pages/SignupPage.tsx` — rewritten.
- `frontend/src/pages/ForgotPasswordPage.tsx` — rewritten.
- `frontend/src/pages/ResetPasswordPage.tsx` — rewritten.
- `frontend/src/pages/VerifyEmailPage.tsx` — rewritten (if exists).
- Deleted: legacy equivalents under `frontend/src/components/` (list them explicitly in the PR description).
- `ARCHITECTURE.md` — section 7 expanded.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`
- `services/qa-loop-executor/src/mcp-browser.ts`
- `services/database/migrations/`
- `gateway/**` (this prompt is pure frontend — do not touch backend)

### Tests
- **Vitest (component)**: one test file per new layout component + one per auth page.
  - `AppShell` renders children, shows sidebar on desktop, shows sheet trigger on mobile (test via viewport mock).
  - `Header` theme toggle toggles; user dropdown opens.
  - `Sidebar` collapses on small screens.
  - Each auth page: renders fields, validates, submits (mocked fetch), shows error on 401.
- **Vitest (hook)**: if the auth flow introduces or modifies an auth hook, test it.
- **Playwright e2e**: `frontend/e2e/auth.spec.ts`
  - Login happy path (seeded test user).
  - Login invalid credentials → localized error visible.
  - Signup happy path.
  - Forgot password sends request.
  - Reset password completes.
  - All of the above captured in 4 variants: desktop-light, desktop-dark, mobile-light, mobile-dark.
- Coverage: 100% for every new/modified file in this prompt.

### i18n
- Add all i18n keys under `auth.*` namespace to `frontend/public/locales/en/common.json` as placeholders with English strings. Keys for other languages are empty now; prompt 19 fills them. The completeness test introduced in prompt 17 tolerates missing keys ONLY during phases 2–3, then fails hard after.
- RTL: all layouts use logical Tailwind properties. No `ml-auto` etc.

### Documentation
- `/docs/auth.md` — English only for now. How auth flows work end-to-end (login → JWT → refresh → logout).

### Acceptance criteria
- [ ] Every listed file created/rewritten or cleanly deleted.
- [ ] Vitest component tests for every new file pass.
- [ ] Playwright `auth.spec.ts` passes in all 4 variants.
- [ ] No legacy auth component exports remain referenced anywhere.
- [ ] Coverage for touched files = 100%.
- [ ] All Tailwind layout uses logical properties (grep returns zero `ml-`/`mr-` in modified files).
- [ ] `ARCHITECTURE.md` updated.
- [ ] No changes to untouchable paths or to `gateway/`.
