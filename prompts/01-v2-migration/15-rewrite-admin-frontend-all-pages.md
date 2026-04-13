# Rewrite `admin-frontend/` — all 10 pages in Shadcn

## Agent
`design-ui-designer` (lead) + `design-ux-architect` (information architecture) + skill `shadcn-design-system-compliance`

## Depends on
`14-validate-frontend-test-runner-and-results.md`

## Goal
Rewrite every page in `admin-frontend/` to use Shadcn primitives, with Shadcn-styled data tables, cursor pagination, camelCase + ISO 8601 data, and full mobile/dark/RTL readiness. This prompt replaces the entire admin UI surface in one sweep — the admin app is small enough (10 pages) that phase-3 is a single implementation prompt + a single validation.

## Reference
- `ARCHITECTURE.md` sections 7, 8.
- Current admin pages: `admin-frontend/src/pages/` (inventory: `DashboardPage.tsx`, `UsersPage.tsx`, `UserDetailPage.tsx`, `PlansPage.tsx`, `SubscriptionsPage.tsx`, `AnalyticsPage.tsx`, `AuditLogPage.tsx`, `SystemSettingsPage.tsx`, `AnnouncementsPage.tsx`, `CreditsPage.tsx`).
- Admin routes: `admin-frontend/src/App.tsx`.
- Shadcn primitives available in `admin-frontend/src/components/ui/` (from prompt 07).

## Task

### 1. Inventory & pattern extraction
`ls admin-frontend/src/pages/` and `ls admin-frontend/src/components/`. For each page, read it and note:
- Data queries (preserve them).
- Table columns (preserve semantic meaning).
- Filters / search (preserve behavior).
- Detail flyouts / modals.
- Write actions (create, update, delete, impersonate).

Identify shared patterns (admin page header, filter bar, paginated table, bulk actions) and factor them into shared components BEFORE rewriting individual pages.

### 2. Shared admin components
Create:
- `admin-frontend/src/components/admin/AdminPageHeader.tsx` — title + breadcrumbs + primary action slot.
- `admin-frontend/src/components/admin/FilterBar.tsx` — search input + chip filters + sort dropdown.
- `admin-frontend/src/components/admin/PaginatedTable.tsx` — TanStack Table + Shadcn `Table` + cursor pagination controls + loading skeleton + empty state.
- `admin-frontend/src/components/admin/BulkActions.tsx` — row selection + action menu.
- `admin-frontend/src/components/admin/StatusBadge.tsx` — color-coded for active/paused/banned/trial/expired.
- `admin-frontend/src/components/admin/DateRangePicker.tsx` — Shadcn calendar + preset ranges.
- `admin-frontend/src/components/admin/ConfirmDialog.tsx` — destructive-action confirmation with type-to-confirm.
- `admin-frontend/src/components/admin/ExportMenu.tsx` — CSV/JSON export dropdown.

### 3. App shell + sidebar nav
Replace `admin-frontend/src/App.tsx` and any current layout with:
- `admin-frontend/src/components/layout/AdminShell.tsx` — same pattern as `frontend/AppShell` but with admin-specific nav groups: Dashboard / Users & Orgs / Billing / Flags / AI / Audit / Analytics / Settings.
- Sidebar collapses to icons on `md:`, full on `xl:`, becomes a Sheet on mobile.
- Header: logo, theme toggle, language switcher placeholder, impersonation indicator, superadmin user dropdown.

Note: the FeatureFlagsPage, BillingConfigPage, AIProvidersPage, UsageTrackingPage are added in later prompts (phase 5 onward). This prompt's nav includes them as disabled entries with a tooltip "Coming in phase N" until then. This is the only place such a placeholder is acceptable.

### 4. Rewrite each existing page

#### `DashboardPage.tsx`
KPI grid matching the frontend dashboard's pattern: MRR, ARR (bigint-cents formatted), trial users, active subscriptions, PAYG usage $, API calls. Tabs: Recent Signups / Recent Payments / Failed Jobs / Error Rate.

#### `UsersPage.tsx`
`PaginatedTable` with columns: id, name, email, org, role, plan, status, last seen, created. `FilterBar` with search, role filter, status filter. Row actions: view detail, impersonate, reset password, ban. `BulkActions`: export, email selected.

#### `UserDetailPage.tsx`
Tabs: Profile / Subscriptions / Usage / Sessions / Audit. Uses Shadcn `Tabs`. Each tab loads lazily. Actions: impersonate, reset password, change org, ban, delete.

#### `PlansPage.tsx`
Cards per plan with bigint-cents → formatted currency display. Edit dialog opens a Shadcn `Form` for name, description, price (in dollars — convert to/from bigint cents on submit/fetch), trial days, features list, is-active toggle.

#### `SubscriptionsPage.tsx`
Paginated table of subscriptions with status, plan, next renewal, MRR contribution. Filters: status, plan, trial vs paid. Row action: view → opens a flyout with full history.

#### `AnalyticsPage.tsx`
Charts (Shadcn `chart` primitive): signups over time, MRR trend, churn rate, feature usage. Date range picker at the top. Export button.

#### `AuditLogPage.tsx`
Paginated table with filters: action type, actor, target, date range. Each row expands to show the diff (Shadcn `Collapsible`).

#### `SystemSettingsPage.tsx`
Shadcn `Tabs` for: General / Email / Webhooks / Security. Each tab is a Shadcn `Form`.

#### `AnnouncementsPage.tsx`
List of announcements with Shadcn `Dialog` for compose (title, body, target audience, scheduled time, published toggle). Publish/unpublish actions.

#### `CreditsPage.tsx`
Ledger view: paginated table of credit grants / deductions. Manual credit-grant dialog. Bulk export.

### 5. All data flows
- Every list endpoint uses cursor pagination. If the existing backend still uses offset pagination, keep the page's UI cursor-ready and mark a TODO in the gateway call site — the gateway migration to cursor happens in phase 8.
- All timestamps rendered via `Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })` with ISO 8601 input.
- All money rendered via a new util `admin-frontend/src/lib/money.ts` that converts bigint cents → localized currency string.

### 6. Delete legacy components
Same rule: clean deletes, no back-compat re-exports. Deleted files go in the PR description.

### 7. i18n keys
Add under `admin.*` namespace to `admin-frontend/public/locales/en/common.json`. Mirror the structure of each page (`admin.users.title`, `admin.users.columns.email`, etc.). See prompt 17 for the completeness contract that will enforce these.

### 8. Update `ARCHITECTURE.md` section 8
Replace the placeholder with a table listing the 10 pages + their shared components + the data contract (cursor pagination, ISO 8601, camelCase, bigint cents).

### Files to create/modify
- `admin-frontend/src/App.tsx` — rewritten.
- `admin-frontend/src/components/layout/AdminShell.tsx` — new.
- `admin-frontend/src/components/admin/**` — 8 shared admin components.
- `admin-frontend/src/pages/DashboardPage.tsx`, `UsersPage.tsx`, `UserDetailPage.tsx`, `PlansPage.tsx`, `SubscriptionsPage.tsx`, `AnalyticsPage.tsx`, `AuditLogPage.tsx`, `SystemSettingsPage.tsx`, `AnnouncementsPage.tsx`, `CreditsPage.tsx` — all rewritten.
- `admin-frontend/src/lib/money.ts` — new, bigint-cents formatter.
- `admin-frontend/public/locales/en/common.json` — `admin.*` keys.
- `ARCHITECTURE.md` — section 8.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`
- `gateway/**` (no backend changes in this prompt)

### Tests
- **Vitest component**: every shared admin component + every page gets a dedicated test file. Render, interactions, empty/loading/error, pagination, bulk actions, confirm dialogs.
- **Vitest util**: `admin-frontend/src/lib/__tests__/money.test.ts` — bigint cents → currency string, round-trip with known values, edge cases (zero, very large, currency formatting per locale).
- **Playwright e2e**: `admin-frontend/e2e/admin-flows.spec.ts`
  - Log in as superadmin (seeded).
  - Walk each page, verify header + table + filters.
  - Perform one write action per page (where applicable): edit plan, grant credit, publish announcement, open audit row, edit system setting.
  - Verify dark, mobile, impersonation banner.
- Coverage: 100% for every touched file.

### i18n
- All page strings in `admin.*` keys.
- No hardcoded English in the JSX — `t('admin.users.title')` or equivalent.

### Documentation
- `/docs/admin.md` — English only. Superadmin operator runbook summary (links to detailed runbook added in prompt 46).

### Acceptance criteria
- [ ] Every existing admin page rewritten.
- [ ] Shared admin components extracted and reused.
- [ ] Money displayed via bigint-cents → localized string everywhere.
- [ ] All timestamps rendered from ISO 8601.
- [ ] Cursor pagination in UI controls even if backend still offset (TODO marked).
- [ ] Vitest 100% coverage on touched files.
- [ ] Playwright e2e passes in light/dark/desktop/mobile.
- [ ] i18n keys under `admin.*` populated in English.
- [ ] `ARCHITECTURE.md` section 8 updated.
- [ ] No changes to untouchable paths or backend.
- [ ] Prior phases still green.
