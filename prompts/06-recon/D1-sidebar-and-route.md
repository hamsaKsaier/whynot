# Recon — Sidebar nav + route registration

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/whynot-dashboard/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`

## Dependencies
- A1, A6, B2

## Task
Add the Recon top-level navigation entry and register its routes. Hide the entry when the `recon_enabled` feature flag is off for the workspace.

### 1. Sidebar entry
- File: `frontend/src/components/layout/Sidebar.tsx`
- Find the `NAV_ITEMS` array (around lines 33–44 per exploration).
- Add a new entry between an appropriate pair (suggest after "QA Loop" since both are AI-driven flows):
  ```ts
  { icon: Shield, labelKey: 'common.nav.recon', path: '/recon', flag: 'recon_enabled' },
  ```
- Update the rendering loop to read the optional `flag` field and call `useFeatureFlag(item.flag)` — items with `flag` set are hidden when the flag returns false.
- Use Lucide's `Shield` icon (already in the project's icon set).
- The icon is symmetric — no `rtl:scale-x-[-1]` needed.

### 2. Routes
- File: `frontend/src/App.tsx`
- Register two routes:
  - `/recon` → `<ReconScansListPage />` (lazy-loaded; component created in D2)
  - `/recon/:scanId` → `<ReconScanDetailPage />` (lazy-loaded; component created in D4)
- Both wrapped in the existing `<ProtectedRoute>` (auth + workspace required).

### 3. Empty placeholders
Until D2 and D4 are merged, scaffold the two page components as placeholder `<div>Recon coming soon</div>` so the route registration compiles. D2/D4 will replace them.

### 4. Feature-flag hiding behavior
- Sidebar item: hidden via `useFeatureFlag('recon_enabled')` returning false.
- Direct URL navigation when flag is off: `/recon` route renders `<NotFoundPage />` (404), not a "feature disabled" message — per A2 review, flag-off should be indistinguishable from "doesn't exist."

### Tests
- `Sidebar.test.tsx`: when `useFeatureFlag` returns true → Recon nav item rendered with correct label + path. When false → NOT rendered (assert by absent test-id).
- `App.test.tsx` (or routing test): visiting `/recon` with flag off → `<NotFoundPage />`.
- Snapshot test: sidebar in en + ar (RTL).
- 100% coverage on changed files.

### i18n
- Add to all 5 locales of `frontend/public/locales/{lng}/common.json`:
  - `common.nav.recon` → en: "Recon", ar: "ريكون", fr: "Recon", de: "Recon", es: "Recon"
  - (The product name "Recon" is intentionally consistent across locales — it's a brand. Arabic may transliterate or keep Latin script per the project's brand-name convention; check existing brand strings.)
- No banned vocabulary.

### Documentation
- N/A in this prompt; D2–D5 + E3 cover the user-visible documentation.

### Files to modify
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/App.tsx`
- `frontend/src/pages/recon/ReconScansListPage.tsx` (placeholder)
- `frontend/src/pages/recon/ReconScanDetailPage.tsx` (placeholder)
- 5 frontend `common.json` locale files
- Tests
