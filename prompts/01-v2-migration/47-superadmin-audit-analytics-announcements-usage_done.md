# Superadmin: Audit Log, Analytics, Announcements, Usage Tracking

## Agent
`design-ui-designer` (lead) + `api-designer`

## Depends on
`46-validate-superadmin-management-pages.md`

## Goal
Rewrite the existing superadmin AuditLog, Analytics, Announcements pages with Shadcn + cursor pagination + real data, and add a new UsageTrackingPage backed by `usage_events` (data path is built in phase 10 — this prompt's UsageTab references it once available).

## Single source of truth
`ARCHITECTURE.md` sections 8, 11, 12.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Backend endpoints
- `GET /api/admin/audit-log?cursor=&limit=&actorId=&action=&from=&to=`
- `GET /api/admin/analytics/overview` — DAU/MAU, signup count, MRR, churn (read from existing tables; no new schema)
- `GET/POST/PATCH/DELETE /api/admin/announcements`
- `GET /api/admin/usage?cursor=&orgId=&from=&to=` (consumes `usage_events` from prompt 57 — until then, returns empty array gracefully)

### 2. Pages
- `admin-frontend/src/pages/AuditLogPage.tsx` — DataTable + filter bar + JSON viewer for before/after
- `admin-frontend/src/pages/AnalyticsPage.tsx` — KPI cards (DAU, MAU, MRR, churn) + line/bar charts (use a small chart lib already in the project, or `recharts` if absent — check first)
- `admin-frontend/src/pages/AnnouncementsPage.tsx` — list + create + edit + publish dialog with i18n message editor (5 language tabs)
- `admin-frontend/src/pages/UsageTrackingPage.tsx` — per-org + per-user usage breakdown; charts; CSV export

### 3. i18n
- `admin:audit.*`, `admin:analytics.*`, `admin:announcements.*`, `admin:usage.*` — 5 languages.
- Announcements editor lets the superadmin author the same message in 5 languages.

### Files to create/modify
- `gateway/src/api/admin/{audit-log,analytics,announcements,usage}.ts` — new
- `admin-frontend/src/pages/{AuditLog,Analytics,Announcements,UsageTracking}Page.tsx` — new
- `admin-frontend/src/router.tsx` — add routes
- `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json` — new keys

### Tests
- Supertest:
  - Audit log filters by actor, action, date range; cursor pagination correct.
  - Analytics returns coherent numbers for a seeded fixture.
  - Announcements CRUD + publish.
  - Usage endpoint returns empty list when no events; correct rows after seeding `usage_events`.
- Vitest component tests for each page.
- Playwright:
  - Filter audit log by date range → table updates.
  - Create + publish an announcement → user side shows the localized message.
  - Charts render in dark mode without contrast issues.
- Coverage: 100% on touched files.

### i18n
- All localized.

### Documentation
- `docs/{en,ar,fr,de,es}/admin/audit-analytics-usage.md`

### Acceptance criteria
- [ ] All 4 pages functional + cursor-paginated.
- [ ] Announcements editable in 5 languages and visible to users.
- [ ] Charts dark + light + RTL friendly.
- [ ] Usage page degrades gracefully until prompt 57 ships.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
