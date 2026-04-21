# Recon — Scans list page

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/whynot-dashboard/`
- Supporting: `.claude/skills/shadcn-design-system-compliance/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`

## Dependencies
- A1, A6, B1, C6, D1

## Task
Build the Recon scans list page at `/recon`. Replaces the D1 placeholder with a real, accessible, i18n + RTL-aware list.

### 1. File
- `frontend/src/pages/recon/ReconScansListPage.tsx` (replace D1 placeholder)
- `frontend/src/pages/recon/components/ReconScanRow.tsx`
- `frontend/src/pages/recon/components/ReconNewScanButton.tsx`
- `frontend/src/pages/recon/hooks/useReconScans.ts`

### 2. Page layout
- Page header: `H1` "Recon" + subtitle from `recon.list.subtitle` + "New scan" button (start of a wizard, D3) on the end side.
- Tab strip (URL-synced per `.claude/rules/url-tab-state.md`):
  - `?tab=running` (default) — pending + running + stuck
  - `?tab=completed`
  - `?tab=failed` — failed + cancelled
  - `?tab=all`
- Table columns: project, environment, status pill, severity rollup (badges per A6), started_at (relative), duration, total cost (credits), actions (cancel / resume / view).
- Cursor-based pagination (per project convention).
- Empty state: friendly empty illustration + CTA to start the first scan.
- Skeleton loading state (no `animate-pulse` on content per `.claude/rules/uncodixify-ui.md` — only on Skeleton placeholders).

### 3. Data
- Hook `useReconScans({ tab, cursor })` calls `GET /api/recon/scans?status=...&cursor=...`.
- Polls every 10s while any scan is `running` or `pending`. Stops polling when the page is hidden (Page Visibility API).

### 4. Filters
Persist filter selections in URL search params (per `.claude/rules/url-tab-state.md`):
- `?project=<projectId>` — multi-select
- `?severity=critical,high` — multi-select
- `?tab=...`
Combined with `validateSearch` on the route.

### 5. Actions
- "View" → navigate to `/recon/:scanId`.
- "Cancel" (only when status ∈ {pending, running}) → confirms via Shadcn `AlertDialog`, then `POST /api/recon/scans/:id/cancel`.
- "Resume" (only when status ∈ {failed, cancelled, stuck}) → opens a small modal asking the user to re-confirm the target URL (matches the API's URL-match guard from C7), then `POST /api/recon/scans/:id/resume`.

### 6. Severity rollup
Show 1–4 badges (only the severities present), each with the count: `[Critical: 2] [High: 5] [Medium: 1]`. Use the soft-fill color scheme from A6.

### Tests
- Vitest:
  - Renders empty state when API returns no scans.
  - Renders skeleton during loading.
  - Switches tab → URL updates → API called with new filter.
  - Polling: every 10s while a `running` scan is in the list; stops when none.
  - Polling pauses when document.visibility = hidden.
  - Cancel button: confirms, calls API, optimistically updates row.
  - Resume button: re-confirmation modal blocks if the URL field is empty.
- Snapshot tests in en + ar (RTL).
- 100% coverage on new files.

### i18n
- All in `frontend/public/locales/{en,ar,fr,de,es}/recon.json`:
  - `recon.list.title`, `.subtitle`, `.empty.title`, `.empty.cta`, `.newScan`
  - `recon.list.tab.running`, `.completed`, `.failed`, `.all`
  - `recon.list.col.project`, `.environment`, `.status`, `.severity`, `.startedAt`, `.duration`, `.cost`, `.actions`
  - `recon.actions.view`, `.cancel`, `.resume`
  - `recon.actions.cancelConfirm.title`, `.body`, `.confirm`, `.cancel`
  - `recon.actions.resumeConfirm.title`, `.body`, `.urlPlaceholder`, `.confirm`
  - `recon.status.pending`, `.running`, `.completed`, `.failed`, `.cancelled`, `.stuck`
- RTL: all logical properties (`ms-*`, `me-*`, `start-*`, `end-*`); flex direction handled natively per the project's `dir="rtl"` setup.
- No banned vocabulary.

### Documentation
- E3 covers the user-facing list-page screenshot.

### Files to modify
- See file list in section 1 above.
- 5 frontend `recon.json` locale files (additions).
- Tests under `frontend/src/pages/recon/__tests__/`.
