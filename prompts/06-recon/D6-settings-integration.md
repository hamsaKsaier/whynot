# Recon — Settings tab

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/whynot-dashboard/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`, `.claude/rules/switch-component-styling.md`

## Dependencies
- A1, A6, B1, B3, C6, D1

## Task
Add a new "Recon" tab to the existing Settings page. Lets a workspace owner configure notifications, set a PAYG cap, and (deferred for now) configure a default schedule.

### 1. File
- `frontend/src/pages/settings/tabs/ReconSettingsTab.tsx`
- Update `frontend/src/pages/settings/SettingsPage.tsx` to register the new tab.

### 2. Tab visibility
- Tab only visible when `useFeatureFlag('recon_enabled')` returns true.
- Per `.claude/rules/url-tab-state.md`: tab state lives in `?tab=recon`.

### 3. Settings UI
- **Notifications**: which workspace members are emailed when a scan completes / fails. Multi-select chip input backed by the existing user-list API.
- **PAYG cap**: max credits per scan (a Shadcn `Input` of type number). 0 = no cap (use platform default). Stored on the workspace via a new `PUT /api/recon/settings` endpoint (add to C6 if missing).
- **Default schedule**: a disabled "Coming soon" row (gated for the future scheduled-scans flag, deferred per D4 in the plan).

### 4. Switch component compliance
Any `Switch` (e.g. "Email me on every scan completion") MUST follow `.claude/rules/switch-component-styling.md` — no `min-h-[44px]` on the Switch itself; touch target via parent row.

### 5. Validation
- PAYG cap must be ≥ 0 and ≤ 100,000 credits. Live error state.

### Tests
- Vitest:
  - Tab hidden when flag off.
  - Tab visible + selectable when flag on.
  - URL syncs `?tab=recon`.
  - Notifications multi-select round-trips an empty selection.
  - PAYG cap input rejects negative + overlarge values.
  - Save calls the API with normalized payload.
  - "Coming soon" row is rendered but disabled.
  - Switch rule regression: no `min-h-[44px]` on the Switch.
  - 100% coverage.
- Snapshot in en + ar.
- A11y: zero critical violations.

### i18n
Add to `frontend/public/locales/{en,ar,fr,de,es}/settings.json`:
- `settings.recon.tab.label`
- `settings.recon.notifications.title`, `.description`, `.emailOnComplete`, `.emailOnFail`
- `settings.recon.notifications.recipients.label`, `.placeholder`, `.empty`
- `settings.recon.paygCap.label`, `.help`, `.error.negative`, `.error.tooLarge`
- `settings.recon.schedule.title`, `.comingSoon`
- `settings.recon.save`, `.saveSuccess`, `.saveError`
- 5 locales. No banned vocabulary.

### Documentation
- E3: "Configuration & notifications" page in `/docs/recon/`.

### Files to modify
- `frontend/src/pages/settings/tabs/ReconSettingsTab.tsx` (new)
- `frontend/src/pages/settings/SettingsPage.tsx` (tab registration)
- 5 frontend `settings.json` locale files
- Tests
- Gateway: `PUT /api/recon/settings` if missing from C6
