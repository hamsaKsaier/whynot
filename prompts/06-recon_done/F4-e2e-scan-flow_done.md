# Recon — End-to-end Playwright tests

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/spec-driven-development/`
- Rules: `.claude/rules/recon-safety.md` (A7), `.claude/rules/rtl-support-arabic.md`

## Dependencies
- All of B, C, D, E.

## Task
Add Playwright e2e tests covering the full Recon user journey, including the negative paths and the Arabic RTL variant.

### 1. Test files
- `frontend/e2e/recon/scan-happy-path.spec.ts`
- `frontend/e2e/recon/scan-authorization-required.spec.ts`
- `frontend/e2e/recon/scan-flag-off.spec.ts`
- `frontend/e2e/recon/scan-cancel-and-resume.spec.ts`
- `frontend/e2e/recon/landing-recon-section.spec.ts`
- `frontend/e2e/landing/pricing.spec.ts` (extend existing)

### 2. Project setup
The Playwright project list (`frontend/playwright.config.ts`) already includes `chromium-desktop-rtl-light/dark` variants — make sure each Recon spec runs under all four (LTR light, LTR dark, RTL light, RTL dark) using a `test.describe.configure({ mode: 'serial' })` block and a project filter.

### 3. Happy path
1. Sign in as a workspace owner with a project that has GitHub repo + an environment with target_url.
2. Click sidebar "Recon".
3. Click "New scan".
4. Wizard step 1: pick project + environment.
5. Wizard step 2: toggle authorization Switch, type a 30-char justification.
6. Wizard step 3: review + click "Start scan".
7. Land on `/recon/:scanId`; phase timeline shows Fingerprinting → running.
8. Wait (mocked executor — instant phase transitions via test fixtures) until status = completed.
9. Findings tab shows ≥1 finding card; click one; PoC viewer expands.
10. Report tab renders Markdown.
11. `axe-core` zero critical violations on the detail page.

### 4. Negative paths
- **Authorization required**: Try to skip step 2 → "Continue" disabled. Try short justification (19 chars) → error visible.
- **Flag off**: With `recon_enabled` disabled for the workspace, navigating to `/recon` → 404 page (NOT a "feature disabled" message). Sidebar item not rendered.
- **Cancel + Resume**: Start a scan, click Cancel (confirms via dialog), status flips to `cancelled`. Click Resume, re-confirm URL, status flips to `pending` then `running`. Mismatched URL in resume dialog → form shows error.

### 5. Landing tests
- `landing-recon-section.spec.ts`: Recon section visible at 360/768/1024/1440. CTAs route correctly. Sample-report modal opens + closes with focus trap.
- `pricing.spec.ts` (extension): Recon row visible in plan-comparison + PAYG sections. Tooltip opens.

### 6. Banned vocabulary on rendered pages
For each spec, after the page loads, assert `await page.content()` does NOT match any banned string (case-insensitive).

### 7. RTL assertions
For RTL variants:
- Sidebar item appears on the start (right) side.
- Phase timeline order matches reading direction.
- Code blocks remain LTR (force `dir="ltr"` on `<pre>`).
- Tooltips and modals open on the appropriate side.

### Tests
- All scenarios in sections 3–6.
- Visual regression snapshots for happy-path screens at all 4 project variants.

### i18n
- Each spec runs in en + ar (via Playwright project variants).
- Smoke check: tests assert the rendered text matches the i18n string for the current locale (not the key path).

### Documentation
- N/A.

### Files to modify
- New/extended files in `frontend/e2e/recon/` and `frontend/e2e/landing/`.
- Optionally extend `frontend/playwright.config.ts` if a new test fixture is needed.
- Test fixtures for instant phase transitions: `frontend/e2e/fixtures/recon-mock-executor.ts`.
