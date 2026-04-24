# Recon — New-scan wizard

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/exploit-safety/` (A4 — UI surface for authorization)
- Supporting: `.claude/skills/signup-flow-cro/` (for step-pacing UX), `.claude/skills/copywriting/`
- Rules: `.claude/rules/recon-safety.md` (A7), `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/switch-component-styling.md`, `.claude/rules/url-tab-state.md`

## Dependencies
- A1, A4, A6, A7, B1, B3, C6, D1, D2

## Task
Build the multi-step wizard that creates a new Recon scan. The wizard's mandatory authorization step is the only safety gate per D6 in the plan.

### 1. File
- `frontend/src/pages/recon/ReconNewScanPage.tsx` at route `/recon/new` (register in `App.tsx` + add to D1's lazy imports)
- `frontend/src/pages/recon/components/wizard/{Step1Target,Step2Authorization,Step3Review}.tsx`
- `frontend/src/pages/recon/hooks/useCreateReconScan.ts`

### 2. Step 1 — Target selection
- Project picker: only projects with a connected GitHub repo (call existing project-list API; filter client-side or add a `?has_repo=true` query if available).
- Environment picker: only environments with a `target_url` set.
- If the chosen environment is tagged `production`, show a prominent warning banner: "You are about to scan a production environment. We will not block this, but you must explicitly confirm in the next step." (per `.claude/rules/recon-safety.md` rule #9). No hard block.
- Optional: config YAML upload (file input, max 64 KB, parsed client-side for shape validation).

### 3. Step 2 — Authorization
- Switch (per `.claude/rules/switch-component-styling.md` — DO NOT apply `min-h-[44px]` to the Switch itself; achieve touch target via parent container).
- Free-text Textarea: justification, min 20 chars, max 1000 chars, with live character counter.
- Required acknowledgement text rendered above the Switch (translated, all 5 locales) — explains:
  - Recon will execute real exploits.
  - Authorization is logged in the audit trail.
  - User must have legal authority to authorize this scan.
- "Continue" button disabled until Switch is on AND justification ≥ 20 chars.

### 4. Step 3 — Review + cost preview
- Summary card: project, environment, target URL, optional config filename.
- Cost preview: pulled from `BillingService.checkReconQuota` via a `GET /api/recon/quota` endpoint (note: if not in C6, add it).
  - "Included scans remaining this month: N" OR
  - "This scan will cost {{credits}} credits"
- "Start scan" button submits `POST /api/recon/scans` with the full payload (including the authorization block).
- On 200: navigate to `/recon/:scanId`.
- On 4xx: surface the localized server message.

### 5. URL state for wizard step
Steps 1/2/3 backed by `?step=1|2|3` per `.claude/rules/url-tab-state.md`. Browser back navigates to previous step rather than leaving the wizard.

### 6. Discard guard
If the user navigates away from the wizard with unsaved input, show an `AlertDialog`: "Discard new scan?" with confirm/cancel.

### Tests
- Vitest:
  - Step 1: project picker shows only repo-connected projects.
  - Step 1: environment picker shows only URL-configured environments.
  - Step 1: production env shows warning banner; does NOT block "Continue".
  - Step 2: Switch off → "Continue" disabled.
  - Step 2: justification 19 chars → "Continue" disabled; 20 chars → enabled.
  - Step 2: 1001-char justification → input clamped to 1000 + error visible.
  - Step 3: cost preview reflects API response (mock both quota states).
  - Submission: API receives the full authorization block.
  - Discard guard: navigating away with input → dialog; confirming discards.
  - Switch styling regression: `min-h-[44px]` is NOT in the Switch's className.
  - 100% coverage.
- Snapshot in en + ar.
- A11y: `axe-core` zero critical violations.

### i18n
- `recon.wizard.step1.title`, `.projectLabel`, `.environmentLabel`, `.configLabel`, `.productionWarning`, `.cta`
- `recon.wizard.step2.title`, `.acknowledgementBody`, `.switchLabel`, `.justificationLabel`, `.justificationPlaceholder`, `.justificationTooShort`, `.justificationTooLong`, `.cta`
- `recon.wizard.step3.title`, `.summary.project`, `.summary.environment`, `.summary.url`, `.summary.config`, `.cost.included`, `.cost.payg`, `.cta`
- `recon.wizard.discard.title`, `.body`, `.confirm`, `.cancel`
- 5 locales each. No banned vocabulary.

### Documentation
- E3: "Quickstart" page walks through this wizard with screenshots in all 5 langs.

### Files to modify
- See file list in section 1.
- 5 frontend `recon.json` locale files.
- Tests.
- `App.tsx` (route registration).
- Gateway: optionally add `GET /api/recon/quota` in C6 if not already present.
