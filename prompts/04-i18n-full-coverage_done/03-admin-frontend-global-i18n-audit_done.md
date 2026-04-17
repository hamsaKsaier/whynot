# Admin Frontend Global i18n Audit & Remediation

## Agent
`.claude/agents/translation-manager.md` — audit.
`.claude/agents/frontend-developer.md` — remediation.

## Skills
`.claude/rules/rtl-support-arabic.md` — must stay compliant.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Same scope as prompt `02-frontend-global-i18n-audit.md`, but scoped to the `admin-frontend/` package. The admin app ships with its own `i18n.ts`, its own `public/locales/`, and its own Vitest suite. Admin pages are explicitly included in the user's requirement that "admin pages are included".

### 1. Pages to audit
Every file under `admin-frontend/src/pages/`:
- `DashboardPage.tsx`
- `AIProvidersPage.tsx`
- `AnalyticsPage.tsx`
- `AnnouncementsPage.tsx`
- `AuditLogPage.tsx`
- `BillingConfigPage.tsx`
- `CreditsPage.tsx`
- `FeatureFlagsPage.tsx`
- `LoginPage.tsx`
- `OrganizationDetailPage.tsx`
- `OrganizationsPage.tsx`
- `PlanEditPage.tsx`
- `PlansPage.tsx`
- `SubscriptionsPage.tsx`
- `SystemSettingsPage.tsx`
- `UsageTrackingPage.tsx`
- `UserDetailPage.tsx`
- `UsersPage.tsx`
- Any other page added since this prompt was written — audit them too.

For each page, walk every component it renders (including admin-specific layout, sidebar, modals, data tables) and convert every hardcoded English string to `t('<namespace>:<key>')`.

### 2. Admin namespaces
The admin-frontend has 5 namespaces: `common`, `auth`, `admin`, `settings`, `superadmin`. Use them as follows:
- `common:` — shared actions, status, toasts, pagination.
- `auth:` — admin login / session expiry.
- `admin:` — feature-scoped keys per page (`admin:organizations.*`, `admin:users.*`, `admin:plans.*`, `admin:featureFlags.*`, etc.).
- `settings:` — admin-level settings (system settings, billing config).
- `superadmin:` — features only superadmins see.

Do **not** add new namespaces. Grow existing ones.

### 3. Special admin surfaces
- Data tables — column headers, empty-state messages, row-action menus must all localize.
- Audit-log entries — the *event* strings are stored in the backend and must come localized via `gateway` (see prompt 04). The UI for filtering and display should use admin-frontend keys.
- Feature flag toggles — label + description must be localized.
- Analytics charts — same axis-label treatment as prompt 01 (Recharts `label={{ value }}`).
- Currency / bigint cents — render via `Intl.NumberFormat(i18n.language, { style: 'currency' })`, never raw `String(cents / 100)`.
- Date ranges — honor `i18n.language` for formatting, and `dir` for layout.

### 4. Translation files
Add new keys to all 5 files per namespace:
- `admin-frontend/public/locales/{en,ar,fr,de,es}/common.json`
- `admin-frontend/public/locales/{en,ar,fr,de,es}/auth.json`
- `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json`
- `admin-frontend/public/locales/{en,ar,fr,de,es}/settings.json`
- `admin-frontend/public/locales/{en,ar,fr,de,es}/superadmin.json`

Maintain the same quality rules as the user-facing frontend: French NBSP, Spanish inverted punctuation pairs, German markers, identical placeholder sets across all 5 files.

### Tests
Docker-only: `make test-admin`.

- Extend `admin-frontend/src/__tests__/i18n-completeness.test.ts` to assert every new key exists in all 5 languages.
- Create or extend `admin-frontend/src/__tests__/i18n-no-hardcoded-strings.test.ts` with the same JSX scanner + brand allowlist approach used on `frontend/`. Scan `admin-frontend/src/**/*.{ts,tsx}`.
- Per-page Vitest smoke tests (one per admin page × 5 locales) — see harness in prompt 05.
- `admin-frontend/src/__tests__/responsive-admin.test.tsx` keeps its existing i18n coverage; expand if new keys change labels it asserts on.
- `admin-frontend/e2e/language-switcher.spec.ts` must stay green.
- Coverage threshold stays at 100% (`admin-frontend/vitest.config.ts`).

### i18n
- New keys across the 5 admin namespaces × 5 languages.
- RTL compliance per `.claude/rules/rtl-support-arabic.md`:
  - Logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) only.
  - No `rtl:flex-row-reverse`.
  - Directional icons carry `rtl:scale-x-[-1]`.
- Currency: bigint cents stored as-is; display uses `Intl.NumberFormat(i18n.language, { style: 'currency', currency })`.

### Documentation
For each of the 5 languages:
- `/docs/{en,ar,es,fr,de}/admin/i18n.md` — new file, mirrored across all 5 language folders. Cover:
  - Admin namespace decision tree (when to use `admin:` vs `superadmin:` vs `common:`).
  - How to add a key to an admin feature.
  - How currency, dates, and audit-log event strings are localized.
  - Pointer to backend i18n doc (`/docs/<lang>/i18n.md`) for backend message localization.

### Verification

```bash
make shell-admin npm run lint
make shell-admin npm run typecheck
make test-admin
make shell-admin npm run rtl:check   # or equivalent make target
make test-e2e                         # admin-frontend language-switcher.spec.ts
```

Acceptance criteria:
- [ ] No hardcoded English strings in `admin-frontend/src/` per the expanded scanner.
- [ ] All 22+ admin pages render cleanly in all 5 locales (per-page smoke tests pass).
- [ ] `i18n-completeness.test.ts` passes for admin namespaces.
- [ ] 100% Vitest coverage preserved.
- [ ] `/docs/{en,ar,es,fr,de}/admin/i18n.md` exists in all 5 languages with identical structure.
