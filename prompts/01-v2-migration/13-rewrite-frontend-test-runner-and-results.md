# Rewrite `frontend/` test runner UI and results views in Shadcn

## Agent
`design-ui-designer` (lead) + `design-ux-architect` (flow review) + skill `shadcn-design-system-compliance`

## Depends on
`12-validate-frontend-dashboard.md`

## Goal
Rewrite the core product UI — the live test-runner screen, the QA loop visualization, and the test-results views — using Shadcn primitives, while **preserving every current behaviour and data binding**. This is the most sensitive rewrite in phase 2: no regressions to how live executions stream, how the user interacts with the browser preview, or how results are displayed.

## Reference
- `ARCHITECTURE.md` sections 6, 7.
- Current code to rewrite:
  - `frontend/src/components/BrowserPreview/` — interactive browser iframe + event overlay.
  - `frontend/src/components/QALoop/` — agent session visualization.
  - `frontend/src/components/TestResults/` — result tables, artifacts, traces.
  - `frontend/src/pages/TestRunnerPage.tsx` (or equivalent) — the container page.
  - `frontend/src/pages/ExecutionDetailPage.tsx` / `ResultsPage.tsx` — detail views.

## Task

### 1. Inventory and map
`ls frontend/src/components/BrowserPreview/ frontend/src/components/QALoop/ frontend/src/components/TestResults/` and read each file. For every sub-component, create a 1-to-1 Shadcn replacement under `frontend/src/components/runner/` or keep the same directory name (whichever feels more natural — verify with `design-ux-architect` consult). Keep the external API (props + events) stable so the pages that import them don't need to change other than the import path.

### 2. `BrowserPreview` rewrite
- Outer frame: Shadcn `Card` with header (URL bar, refresh, open-in-tab, fullscreen toggle) + content (iframe) + footer (status badge, latency).
- Overlay for agent events: Shadcn `HoverCard` and `Tooltip` for event pins; color-coded with status tokens (success / warning / error / info).
- Side panel: Shadcn `Sheet` for the event history with filters (event type, time range).
- Do NOT change the websocket / streaming protocol. The component is presentational; data flows through existing hooks.

### 3. `QALoop` rewrite
- Agent board: Shadcn `Card` per agent with name, role, status badge, current task, queue length, token count.
- Timeline: vertical Shadcn `Card` + `Separator` + `Badge` combo showing each agent step with timestamps.
- Focus mode: Shadcn `Dialog` that opens on click of a step, showing the full tool call + result + raw AI output.
- Pause / resume / stop controls at the top via Shadcn `Button` group.

### 4. `TestResults` rewrite
- Result summary: Shadcn `Card` row with pass/fail counters + duration + assertion count.
- Result table: Shadcn `Table` or `DataTable` (TanStack Table wrapper) with cursor pagination (never offset). Columns: name, status, duration, browser, device, artifacts link, rerun button.
- Artifact viewer: Shadcn `Dialog` embedding screenshot carousel + trace timeline + DOM snapshot tree.
- Trace viewer: Shadcn `Tabs` (Console / Network / DOM / Actions). If trace viewer is currently a Playwright iframe, keep it as an iframe child; just restyle the wrapper.

### 5. Page containers
- `frontend/src/pages/TestRunnerPage.tsx` — hosts live `BrowserPreview` + `QALoop`. Two-column layout on `lg:`, stacked on mobile. Tailwind `grid`.
- `frontend/src/pages/ExecutionDetailPage.tsx` (or wherever results land) — hosts `TestResults` + artifact viewer.
- Both pages must handle loading, error, and "no execution in progress" empty states.

### 6. Accessibility
- Live region (`aria-live="polite"`) for streaming agent events so screen readers announce progress.
- Keyboard shortcuts: `space` pause/resume, `r` rerun, `esc` close detail dialog. Document in a `KeyboardShortcutsDialog` Shadcn dialog behind `?`.

### 7. i18n keys
Add under `runner.*` and `results.*` namespaces to `frontend/public/locales/en/common.json`:
- `runner.title`, `runner.paused`, `runner.running`, `runner.finished`, `runner.error`
- `runner.controls.pause`, `.resume`, `.stop`, `.rerun`, `.fullscreen`
- `runner.agent.status.idle`, `.running`, `.blocked`, `.done`
- `runner.preview.url.placeholder`, `.refresh`, `.open`
- `results.summary.pass`, `.fail`, `.skipped`, `.duration`, `.assertions`
- `results.table.columns.name`, `.status`, `.duration`, `.browser`, `.device`, `.artifacts`
- `results.artifact.screenshot`, `.trace`, `.dom`, `.console`, `.network`
- `results.empty.title`, `.description`, `.cta`
- `results.rerun.confirm`, `.success`, `.error`

### 8. Update `ARCHITECTURE.md`
Section 7 "Frontend architecture" → add "Runner / Results" subsection with the component catalog and the "component API stable across the rewrite" guarantee.

### Files to create/modify
- `frontend/src/components/BrowserPreview/**` — rewritten (keep directory name, same exported symbols).
- `frontend/src/components/QALoop/**` — rewritten.
- `frontend/src/components/TestResults/**` — rewritten.
- `frontend/src/pages/TestRunnerPage.tsx` — rewritten.
- `frontend/src/pages/ExecutionDetailPage.tsx` — rewritten.
- `frontend/src/components/KeyboardShortcutsDialog.tsx` — new.
- `ARCHITECTURE.md` — section 7 updated.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`
- `services/qa-loop-executor/src/mcp-browser.ts`
- `services/database/migrations/`
- `gateway/**` (no backend changes in this prompt)

### Tests
- **Vitest component**: every sub-component under BrowserPreview, QALoop, TestResults has a test asserting render + prop responses + key interactions. Use mocked websocket/event emitters.
- **Vitest integration**: the TestRunnerPage mounts with a mock streaming source, plays back a pre-recorded event sequence, and asserts the UI reflects each step (pass/fail counters increment, agent board updates, DOM/console logs appear).
- **Playwright e2e**: `frontend/e2e/runner.spec.ts`
  - Starts a test run (test backend seeds a fake execution), watches the live preview, pauses, resumes, stops.
  - Verifies dark mode, mobile layout, keyboard shortcuts.
  - Opens results, clicks an artifact, verifies trace viewer tabs render.
- **Performance**: Playwright measures time-to-first-event-render under a simulated 100ms network. Must be under 500ms.
- Coverage: 100% for every touched file.

### i18n
- Keys in step 7 added to English locale file.

### Documentation
- `/docs/test-runner.md` — English only. Explains the runner UI, controls, shortcuts, results layout, trace viewer.

### Acceptance criteria
- [ ] All files rewritten; no legacy imports remain.
- [ ] External component API (props, events) unchanged.
- [ ] Vitest 100% coverage on touched files.
- [ ] Playwright e2e runner spec passes in light/dark/desktop/mobile.
- [ ] Axe: zero serious/critical violations.
- [ ] Live region announces streaming events.
- [ ] Keyboard shortcuts work.
- [ ] i18n keys added.
- [ ] `ARCHITECTURE.md` updated.
- [ ] Prior phases (auth, dashboard) still green.
- [ ] No changes to untouchable paths.
