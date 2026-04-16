# 12 — Responsive: Test Runner, QA Loop, Results, Execution Views

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- STYLES.md

## Task

Make the test runner and results surfaces fully responsive.

**Routes in scope**:
- `frontend/src/pages/QALoopPage.tsx`
- `frontend/src/pages/TestRunnerPage.tsx`
- `frontend/src/pages/ResultsPage.tsx`
- `frontend/src/pages/PublicScanResultsPage.tsx`
- `frontend/src/components/TestRunner/TestExecutionView.tsx`
- `frontend/src/components/TestRunner/SessionForm.tsx`
- `frontend/src/components/QALoop/SessionForm.tsx`
- Any live log / streaming view
- Visual regression report viewer if present

### Scope / Requirements

1. **Session form**
   - Multi-step wizard on mobile (one step per screen); split layout on `lg+`.
   - Inputs mobile-friendly (`inputMode`, `autocomplete`).
   - Submit button full-width on mobile.

2. **Live execution view**
   - Streaming log viewer: `h-[50vh]` on mobile, fixed `h-[600px]` on desktop, with inner `overflow-y-auto`.
   - Log lines must wrap on narrow screens (no horizontal scroll).
   - Action buttons (pause, stop, restart) sticky at top on mobile.
   - Browser preview iframe: responsive aspect ratio, full-width on mobile.

3. **Results tables**
   - Standard results table on desktop.
   - On mobile: collapse each row into a card stack (`md:hidden` table, `hidden md:block` card list — or the inverse).
   - Filters: bottom drawer on mobile, top bar on desktop.
   - Pagination: full pagination on desktop, simple prev/next on mobile.

4. **Public scan results page**
   - Marketing surface — needs to look good as a shareable link.
   - Coordinate with prompt 07 to drop gradient/glassmorphism.
   - Mobile-first; single column below `md`.

5. **Visual regression report**
   - Screenshot comparison slider: touch-friendly on mobile (larger thumb, ≥44px tall).
   - Before/after images stack vertically on mobile.

6. **Touch targets, dark mode, RTL, logical properties** — as in prior prompts.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots**: 7 viewport sizes, visual regression.
- **Streaming log**: e2e test streams fake log lines and asserts they wrap correctly on 375px.
- **Table↔card switch**: assert table hidden below `md`, card list visible; inverse above `md`.
- **Public scan result page**: snapshot + a11y + contrast in both themes.
- **RTL**: same suite with `lang=ar`.
- **i18n**: all 5 languages, German overflow check.

### i18n (5 languages)
- Keys under `runner.*`, `results.*`, `common.*` from prompt 01.
- Backend streaming messages (WebSocket payloads) must be language-aware if they contain user-facing text — coordinate with prompt 06.

### Documentation
- `/docs/en/user-guide/testing/run-tests.md`, `view-results.md`.
- 5-language variants.

### Constraints
- Docker-only.
- WebSocket streams unchanged.
- Preserve uncodixify compliance.

### Verification steps
1. `make shell-client npm run typecheck && npm run lint && npm test`
2. `make shell-client npm run test:responsive -- runner results execution`
3. `make start` → run a real test session at 320px and 1280px, confirm live logs and results render.
