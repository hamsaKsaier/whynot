# Settings: Usage tab UI + Danger Zone export

## Agent
`design-ui-designer` (lead) + `api-designer`

## Depends on
`58-validate-usage-events-and-tracker.md`

## Goal
Add a UsageTab to Settings showing charts + a recent-events list, and finalize the Danger Zone export to produce a complete CSV/JSON of the user's data.

## Single source of truth
`ARCHITECTURE.md` sections 7, 11.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. UsageTab
- `frontend/src/pages/settings/tabs/UsageTab.tsx`:
  - Date range picker (last 7d / 30d / 90d / custom)
  - KPI cards: total events, total events charged, current PAYG balance
  - Stacked bar chart by event type, line chart by day
  - Recent events table (cursor pagination, last 100)
  - Export CSV button (this period)
- Wire under Settings tabs from prompt 55.

### 2. Backend endpoints
- `GET /api/me/usage/summary?from=&to=` — KPI numbers
- `GET /api/me/usage/by-day?from=&to=` — daily aggregation
- `GET /api/me/usage/recent?cursor=&limit=` — recent events
- `GET /api/me/usage/export.csv?from=&to=` — streamed CSV

### 3. Danger Zone export improvements
- Extend the export from prompt 55 to bundle every user-owned dataset: profile, settings, AI configs (keys redacted), test runs, results, billing history, usage events, audit log entries where the user is the actor.
- Output as a single ZIP with one file per dataset (CSV + JSON).
- Async job: `POST /api/me/export` returns a job id; `GET /api/me/export/:id` polls; download URL signed + short-lived.

### 4. i18n
- All UI strings; 5 languages.

### Files to create/modify
- `frontend/src/pages/settings/tabs/UsageTab.tsx` — new
- `gateway/src/api/me/usage.ts` — new
- `gateway/src/api/me/export.ts` — extended
- `frontend/public/locales/{en,ar,fr,de,es}/settings.json` — extend

### Tests
- Vitest component tests for UsageTab including chart props.
- Supertest:
  - Each usage endpoint with seeded events → expected aggregates.
  - Export CSV streaming → header row + data rows match.
  - Export ZIP job → poll → URL → download → contents valid (CSVs parseable, JSONs valid).
- Playwright e2e:
  - Run a metered action → wait flush interval → UsageTab "recent events" reflects it.
  - Trigger export → wait completion → download → unzip → verify file list.
- Coverage: 100% on touched files.

### i18n
- All localized.

### Documentation
- `docs/{en,ar,fr,de,es}/usage/user-guide.md`

### Acceptance criteria
- [ ] UsageTab functional with charts + recent events.
- [ ] Export bundles all user-owned data, redacts secrets, signed URLs.
- [ ] 100% coverage on touched files.
- [ ] Localized in 5 languages.
- [ ] No untouchable path changes.
