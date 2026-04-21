# Recon — Scan detail page

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/whynot-dashboard/`
- Supporting: `.claude/skills/shadcn-design-system-compliance/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`

## Dependencies
- A1, A6, B1, C6, D1, D5 (the FindingCard component must exist before this page consumes it)

## Task
Build the per-scan detail page at `/recon/:scanId` showing live progress, findings, the rendered report, and raw artifacts. Replaces the D1 placeholder.

### 1. File
- `frontend/src/pages/recon/ReconScanDetailPage.tsx` (replace D1 placeholder)
- `frontend/src/pages/recon/components/PhaseTimeline.tsx`
- `frontend/src/pages/recon/components/ReportViewer.tsx`
- `frontend/src/pages/recon/hooks/useReconScan.ts`

### 2. Page header
- Breadcrumb: Recon › {project name} › Scan ID (truncated).
- Status pill (per A6 severity badge style — but for scan status: pending/running/completed/failed/cancelled/stuck).
- Action menu: Cancel (only for active), Resume (only for failed/cancelled/stuck), Download PDF (only for completed), Re-run (clones authorization payload, opens the wizard pre-filled).

### 3. Tabs (URL-synced per `.claude/rules/url-tab-state.md`)
- `?tab=findings` (default if scan completed)
- `?tab=phases` (default if scan running)
- `?tab=report`
- `?tab=raw` (artifacts list)

### 4. Findings tab
- Filter strip: severity multi-select (`?severity=...`), vuln class multi-select (`?vulnClass=...`).
- Sort: severity desc by default; allow toggle to "First confirmed" (chronological).
- Renders a list of `<ReconFindingCard>` components (D5).
- Empty state for completed scans with zero findings: encouraging copy + suggestion to schedule the next scan.

### 5. Phases tab
- `<PhaseTimeline>` showing all 5 phases with status, started_at, duration, error_message if any.
- Per A6: vertical timeline on small screens, horizontal on `lg+`. `Loader2 animate-spin` for the running phase.
- Live updates: poll `GET /api/recon/scans/:id` every 5s while status ∈ {pending, running}.
- Stuck banner: if status === 'stuck', show a top-of-page warning with a "Resume" CTA.

### 6. Report tab
- `<ReportViewer>` renders the Markdown from `GET /api/recon/scans/:id/report`.
- Sticky table-of-contents on the start side at `lg+`.
- Available only when scan status === 'completed'; otherwise renders a skeleton + message "The report will appear once the scan completes."

### 7. Raw tab
- List of `recon_scan_artifacts` rows: phase, kind, size, created_at, download link.
- Confirms download via Shadcn `AlertDialog` for any artifact > 10 MB.

### 8. Real-time updates
- The `useReconScan(scanId)` hook polls every 5s while active; switches to no-poll once status is terminal.
- Visibility-aware: stops polling when document.visibility = hidden.
- After successful Cancel or Resume, refetch immediately.

### Tests
- Default tab is `findings` for completed, `phases` for running (deterministic from status).
- Tab change syncs URL search params.
- Polling cadence matches status (5s for active, never for terminal).
- Stuck banner renders when status === 'stuck'.
- Cancel/Resume actions disabled appropriately by status.
- Report tab: skeleton when scan is running; renders Markdown when completed.
- A11y: `axe-core` zero critical violations.
- Snapshot in en + ar (RTL).
- 100% coverage.

### i18n
Add to `frontend/public/locales/{en,ar,fr,de,es}/recon.json`:
- `recon.detail.breadcrumb.scan`, `.tab.findings`, `.tab.phases`, `.tab.report`, `.tab.raw`
- `recon.detail.actions.cancel`, `.resume`, `.downloadPdf`, `.rerun`
- `recon.detail.findings.empty`, `.filter.severity`, `.filter.vulnClass`, `.sort.severity`, `.sort.chronological`
- `recon.detail.phases.title`, `.stuckBanner`, `.stuckCta`
- `recon.detail.report.notReady`, `.toc`
- `recon.detail.raw.col.phase`, `.col.kind`, `.col.size`, `.col.createdAt`, `.col.download`
- `recon.detail.raw.largeDownload.title`, `.body`, `.confirm`, `.cancel`
- 5 locales each. No banned vocabulary.

### Documentation
- E3: "Reading reports" + "Understanding findings" pages reference this UI.

### Files to modify
- See file list in section 1.
- 5 frontend `recon.json` locale files.
- Tests.
