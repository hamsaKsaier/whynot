# Superadmin: Users + Organizations management pages

## Agent
`design-ui-designer` (lead) + `api-designer` + skill `audit-logging`

## Depends on
`42-validate-superadmin-shell.md`

## Goal
Build the superadmin Users and Organizations pages with full management capabilities: search, view detail, impersonate, reset password, change org, force plan, force flag override, view audit history.

## Single source of truth
`ARCHITECTURE.md` section 8.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Backend endpoints
- `gateway/src/api/admin/users.ts`:
  - `GET /api/admin/users?cursor=&limit=&q=` — cursor pagination + search
  - `GET /api/admin/users/:id` — detail (subscription, flags, recent activity, audit)
  - `POST /api/admin/users/:id/impersonate` — issues a short-lived token, returns it; audit-logged
  - `POST /api/admin/users/:id/reset-password` — sends a reset email
  - `PATCH /api/admin/users/:id/organization` — moves user to a different org
  - `PATCH /api/admin/users/:id/plan` — force-set plan
- `gateway/src/api/admin/organizations.ts`:
  - `GET /api/admin/organizations?cursor=&limit=&q=`
  - `GET /api/admin/organizations/:id`
  - `PATCH /api/admin/organizations/:id` — name, status, plan
  - `POST /api/admin/organizations/:id/flags/:key` — flag override (delegates to phase 5 logic)

### 2. UI pages
- `admin-frontend/src/pages/UsersPage.tsx` — Shadcn DataTable, search box, row actions menu
- `admin-frontend/src/pages/UserDetailPage.tsx` — tabs: Overview, Subscription, Flags, Audit
- `admin-frontend/src/pages/OrganizationsPage.tsx` — DataTable + actions
- `admin-frontend/src/pages/OrganizationDetailPage.tsx` — tabs: Overview, Members, Subscription, Flags, Audit
- "Impersonate" button opens a confirm dialog → exchanges the token → opens the user-side app in a new tab via the impersonation token in URL.

### 3. Audit
- Every mutation writes an audit row with actor, action, target, before/after.

### 4. i18n
- All UI strings via `t('admin:*')` keys; 5 languages.

### Files to create/modify
- `gateway/src/api/admin/users.ts`, `gateway/src/api/admin/organizations.ts` — new
- `admin-frontend/src/pages/{Users,UserDetail,Organizations,OrganizationDetail}Page.tsx` — new
- `admin-frontend/src/router.tsx` — add routes
- `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json` — new keys

### Tests
- Supertest:
  - Pagination + search work, return camelCase.
  - Impersonation token short-lived; assertable expiry.
  - Cross-org access denied (only superadmin allowed).
  - Mutations create audit rows.
- Vitest component tests for Users, UserDetail, Orgs, OrgDetail.
- Playwright e2e:
  - List users → search → open detail → reset password → assert email queued.
  - Impersonate user → open user-side app → assert impersonation banner visible.
  - Move user to another org → assert membership change.
- Coverage: 100% on touched files.

### i18n
- All localized.

### Documentation
- `docs/{en,ar,fr,de,es}/admin/users-orgs.md` — explains capabilities and audit guarantees.

### Acceptance criteria
- [ ] All endpoints work + are superadmin-gated.
- [ ] All pages functional in 5 languages × dark/light × ltr/rtl.
- [ ] Impersonation safe (short token, audit row, banner visible).
- [ ] Mutations audit-logged with before/after.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
