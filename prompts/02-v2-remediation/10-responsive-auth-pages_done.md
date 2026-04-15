# 10 — Responsive: Auth Pages

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/rtl-support-arabic.md`
- STYLES.md

## Task

Make every authentication route extremely responsive (320px → 2560px). Today these pages work on desktop but have touch-target gaps, overflow issues, or non-mobile-first layouts.

**Routes in scope**:
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/SignupPage.tsx`
- `frontend/src/pages/ForgotPasswordPage.tsx`
- `frontend/src/pages/ResetPasswordPage.tsx`
- `frontend/src/pages/VerifyEmailPage.tsx` (if present)
- `frontend/src/pages/TwoFactorPage.tsx` (if present)
- Any shared auth layout (`frontend/src/routes/_auth/*`).

Also include the admin auth login flow under `admin-frontend/src/pages/LoginPage.tsx`.

### Scope / Requirements

1. **Mobile-first rewrite**
   - Default styles for 320px; opt in to larger layouts with `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px).
   - Card width: `w-full max-w-md mx-auto` on mobile; centered on desktop.
   - Page padding: `p-4 sm:p-6 md:p-8`.
   - Logo sizing: smaller on mobile (`h-8 sm:h-10 md:h-12`).

2. **Touch targets (WCAG 2.1 AA)**
   - Every interactive element must have a ≥44x44px touch target.
   - Achieve via parent containers (`min-h-[44px] flex items-center`), NOT on Switch components directly (per `.claude/rules/switch-component-styling.md`).
   - Checkbox/Radio labels entirely clickable.

3. **Form ergonomics**
   - Inputs: `inputMode`, `autocomplete`, `enterKeyHint` attributes for mobile keyboards.
     - Email: `type="email" inputMode="email" autocomplete="email"`
     - Password: `type="password" autocomplete="current-password"` (or `new-password` for signup)
     - OTP: `inputMode="numeric" autocomplete="one-time-code" pattern="[0-9]*"`
   - Form stacks vertically on all sizes (no horizontal forms below md).
   - Submit button full-width on mobile, auto-width on sm+.

4. **Error states**
   - Inline field errors appear below the field, never in a floating tooltip.
   - Form-level errors in an `<Alert variant="destructive">` above the form.
   - Messages localized via `t()` (coordinate with prompt 01).

5. **Split-screen layouts**
   - If a page has a decorative aside (image/testimonial), collapse to single column below `lg` (`hidden lg:flex`).
   - Never show a truncated aside on mid-range screens.

6. **Keyboard & focus**
   - First input receives `autoFocus` on mount.
   - Focus ring visible on all interactive elements.
   - Tab order logical.

7. **Dark mode**
   - All colors from semantic tokens (coordinate with prompt 09).
   - No hardcoded `bg-white`.

8. **RTL**
   - Logical properties throughout (`ms-*`, `me-*`, `text-start`).
   - Directional icons mirrored.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots**: Playwright captures each auth page at `320x568`, `375x667`, `414x896`, `768x1024`, `1024x768`, `1280x800`, `1920x1080`. All must pass visual regression.
- **Touch target test**: axe-core custom rule asserts every `button`, `a`, `input[type=checkbox]`, `input[type=radio]` has computed size ≥ 44px.
- **No horizontal scroll**: assert `document.body.scrollWidth <= window.innerWidth` on every viewport.
- **Keyboard flow**: e2e test tabs through each form and submits via Enter.
- **Mobile keyboard**: assert `inputMode` and `autocomplete` attributes present on inputs.
- **RTL**: repeat the same suite with `lang=ar`, assert `dir="rtl"` and mirrored layout.
- **Theme**: repeat in dark mode, assert no `bg-white` computed styles on root containers.
- **i18n**: run each page in all 5 languages; assert no text overflow (especially German).

### i18n (5 languages)
- Reuse keys from prompt 01 (`auth.login.*`, `auth.signup.*`, `auth.forgotPassword.*`, etc).
- Backend auth error messages (`errors.auth.invalidCredentials`, etc) come from prompt 06 — ensure they render in the current language on submission failure.
- RTL rendering verified.

### Documentation
- `/docs/en/user-guide/account/sign-in.md` (and sign up, forgot password) — how users sign in, recover accounts, enable 2FA.
- 5-language variants.

### Constraints
- Docker-only: `make shell-client`, `make shell-admin`.
- Follow STYLES.md and `.claude/rules/uncodixify-ui.md`.
- No new dependencies.
- Preserve all existing auth logic and API calls.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test`
3. `make shell-client npm run test:responsive`
4. `make start` → open each auth page at 320px, 375px, 768px, 1280px viewports and confirm zero layout issues in all 5 languages and both themes.
