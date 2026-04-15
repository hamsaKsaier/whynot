# Superadmin: role, middleware, base shell

## Agent
`api-designer` (lead) + `design-ui-designer` + skill `audit-logging`

## Depends on
`40-validate-billing-ui-and-emails.md`

## Goal
Introduce the `superadmin` role, the `requireSuperadmin` middleware, and the admin-frontend base layout shell with the full nav grouping (Users / Orgs / Billing / Flags / AI / Audit / Usage / Settings).

## Single source of truth
`ARCHITECTURE.md` sections 8, 13.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/server/api/routers/superadmin.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (new column requires user coordination)

## Task

### 1. Coordinate migration with user
- Determine if `users.role` already supports `superadmin` value or if a new migration is needed (likely a CHECK constraint update or a new boolean `is_superadmin`).
- After user approval, create `services/database/migrations/0NN_superadmin_role.sql`. If a column exists, no-op + document.

### 2. Middleware
- `gateway/src/middleware/require-superadmin.ts`:
  ```ts
  export function requireSuperadmin(req, res, next) {
    if (!req.user?.isSuperadmin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: req.t('errors:auth.forbidden') } });
    }
    next();
  }
  ```
- Apply to every existing `gateway/src/api/admin/**` route.

### 3. Admin shell
- `admin-frontend/src/layouts/AdminShell.tsx`:
  - Header (logo, language switcher, user menu, dark-mode toggle)
  - Sidebar nav grouped: **Platform** (Users, Organizations), **Billing** (Plans, Subscriptions, Billing Config), **Flags & AI** (Feature Flags, AI Providers), **Insights** (Audit Log, Analytics, Usage), **Content** (Announcements), **Settings** (System Settings)
  - Each nav item links to a route; routes that don't exist yet point to a placeholder page that says "Coming in prompt N".
- Replace `useIsSuperadmin` stub from prompt 15 with a real check against `/api/me` returning `isSuperadmin: true/false`.
- Non-superadmin users hitting any admin route → redirect to `/`.

### 4. Admin login flow
- `admin-frontend/src/pages/LoginPage.tsx` — superadmin login.
- After successful login, fetch `/api/me`; if not superadmin → log out + show "access denied" message localized.

### 5. i18n
- `admin:nav.*`, `admin:auth.*` keys, all 5 languages.

### Files to create/modify
- `services/database/migrations/0NN_superadmin_role.sql` — new (if needed, user-coordinated)
- `gateway/src/middleware/require-superadmin.ts` — new
- `gateway/src/api/admin/**` — apply middleware
- `admin-frontend/src/layouts/AdminShell.tsx` — new
- `admin-frontend/src/hooks/useIsSuperadmin.ts` — replace stub with real impl
- `admin-frontend/src/pages/LoginPage.tsx` — adapted
- `admin-frontend/src/router.tsx` — wrap admin routes in AdminShell + role guard
- `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json` — new keys

### Tests
- Unit: middleware allows superadmin, blocks non-superadmin, returns localized message in fr + ar.
- Supertest: every admin endpoint denies non-superadmin and allows superadmin.
- Vitest component: AdminShell renders for superadmin, redirects for non-superadmin.
- Playwright: superadmin login → land on dashboard; non-superadmin login → access-denied screen.
- Coverage: 100% for touched files.

### i18n
- All shell + auth strings localized in 5 languages.

### Documentation
- `docs/{en,ar,fr,de,es}/admin/access-control.md` — explains the role model and the middleware.

### Acceptance criteria
- [ ] `requireSuperadmin` blocks non-superadmin everywhere.
- [ ] AdminShell renders in 5 languages × dark/light × ltr/rtl.
- [ ] Non-superadmin cannot reach admin routes.
- [ ] Audit log records every superadmin login.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
