# 17 — Responsive: Superadmin Pages (13 Routes)

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/url-tab-state.md`
- `.claude/rules/spec-driven-development.md`
- STYLES.md

## Task

Make every superadmin page responsive. These live inside `admin-frontend/src/pages/` and are role-gated to `super_admin`. Content is data-dense (users, orgs, plans, subscriptions, flags, AI configs, audit logs, analytics, usage, announcements, system settings) — the biggest challenge is responsive tables.

**Routes in scope** (13 pages):
- `admin-frontend/src/pages/UsersPage.tsx`
- `admin-frontend/src/pages/UserDetailPage.tsx`
- `admin-frontend/src/pages/OrganizationsPage.tsx`
- `admin-frontend/src/pages/OrganizationDetailPage.tsx`
- `admin-frontend/src/pages/PlansPage.tsx`
- `admin-frontend/src/pages/SubscriptionsPage.tsx`
- `admin-frontend/src/pages/CreditsPage.tsx`
- `admin-frontend/src/pages/BillingConfigPage.tsx`
- `admin-frontend/src/pages/FeatureFlagsPage.tsx`
- `admin-frontend/src/pages/AIProvidersPage.tsx`
- `admin-frontend/src/pages/AuditLogPage.tsx`
- `admin-frontend/src/pages/AnalyticsPage.tsx`
- `admin-frontend/src/pages/UsageTrackingPage.tsx`
- `admin-frontend/src/pages/AnnouncementsPage.tsx`
- `admin-frontend/src/pages/SystemSettingsPage.tsx`

### Scope / Requirements

1. **Data tables → responsive cards**
   - Every list page uses a shared `<ResponsiveTable />` component: renders a `<Table>` above `md`, renders a card stack below `md`.
   - Table headers become card field labels on mobile.
   - Row actions (edit, delete, view) inline as buttons on desktop; grouped into a dropdown on mobile (but NO 3-dot menu — use an "Actions" button with a sheet).
   - Column priority: show only 3-4 essential fields on mobile; full detail on tap.
   - Replace `text-left`/`text-right` with `text-start`/`text-end`.

2. **Filter/search**
   - Search input sticky at top.
   - Filters: inline row on desktop, bottom sheet on mobile.
   - Pagination: full on desktop, simple prev/next on mobile.

3. **Detail pages (Users, Orgs)**
   - Tab navigation for user/org detail sub-sections; persists in URL per `.claude/rules/url-tab-state.md`.
   - Collapse tabs to dropdown on mobile.

4. **Forms (Plans, Flags, AI Providers, SystemSettings)**
   - Stacked labels + inputs on mobile, side-by-side on `md+`.
   - Long forms split into sections with anchor links on desktop, accordion on mobile.

5. **Analytics page**
   - Charts: responsive width, legend below on mobile.
   - Date range picker: full-screen modal on mobile.
   - Metric cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

6. **Audit log**
   - Infinite scroll or paginated list.
   - Each entry: timestamp, actor, action, target, details expand-on-tap.
   - Filters by actor, action type, date range.

7. **Announcements**
   - Rich text editor: responsive toolbar (collapse to dropdown on mobile).
   - Preview pane: hidden on mobile, visible on `lg+`.

8. **Feature flags**
   - Table of flags with toggle switches.
   - Switch component follows `.claude/rules/switch-component-styling.md` — no `min-h-[44px]` directly on Switch.
   - Percentage rollout slider: touch-friendly.

9. **AI providers**
   - Provider cards (Anthropic, OpenAI, etc) with API key inputs, model selection, test button.
   - Key inputs masked with show/hide toggle.

10. **Touch targets, dark mode, RTL, logical properties, uncodixify compliance**.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots** at 7 viewports for each of the 13 pages.
- **ResponsiveTable switch**: assert table hidden below `md`, card list visible.
- **Role gating**: non-superadmin users cannot render any of these pages (redirected to `/login`).
- **URL tab state**: detail pages persist `?tab=...`.
- **Filters + pagination**: e2e.
- **Chart rendering**: assert charts resize on viewport change.
- **i18n**: all 5 languages, German overflow check.
- **RTL**: all pages render correctly in Arabic.
- **a11y/contrast**: light + dark.

### i18n (5 languages)
- Keys under `admin.*`, `superadmin.*` namespace from prompt 01.
- Backend list/action messages localized via prompt 06.
- Dates/numbers/currencies locale-aware.

### Documentation
- `/docs/en/admin/superadmin/*.md` — one per page (users, orgs, plans, etc).
- 5-language variants.
- Link from admin docs index.

### Constraints
- Docker-only: `make shell-admin`.
- Service component pattern where applicable (`.claude/rules/spec-driven-development.md`).
- URL tab state per `.claude/rules/url-tab-state.md`.
- Switch styling per `.claude/rules/switch-component-styling.md`.
- Uncodixify compliance.
- Must work via both `admin.whynot.skrum.io` and `superadmin.whynot.skrum.io` (see prompt 18).

### Verification steps
1. `make shell-admin npm run typecheck && npm run lint && npm test`
2. `make shell-admin npm run test:responsive -- superadmin`
3. `make start` → sign in as super_admin to `http://localhost:5184`, visit each of the 13 pages at 320/768/1280 in all 5 languages and both themes.
4. Create, edit, delete at least one record on each CRUD page to verify the flow works on mobile.
