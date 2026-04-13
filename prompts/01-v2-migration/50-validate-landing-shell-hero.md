# Validate: Landing shell + Hero

## Agent
`design-ui-designer` (verifier)

## Depends on
`49-landing-shell-hero-header-footer.md`

## Goal
Verify the landing route renders cleanly in 5 languages × dark/light × ltr/rtl, accessibility passes, and routing is correct for both anonymous and authenticated users.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component tests pass.

### 2. Routing
- Anonymous user opens `/` → LandingPage.
- Authenticated user opens `/` → LandingPage with "Open app" CTA visible.
- `/app` still serves the dashboard with auth guard intact.

### 3. Playwright visual
- Capture `/` in en, ar, fr, de, es × light/dark × desktop/mobile.
- Sticky header transitions on scroll.
- Mobile drawer opens + closes; focus trap correct.

### 4. Accessibility
- Axe scan on `/`: zero violations.
- Lighthouse mobile a11y ≥ 95.

### 5. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands exit 0.
- [ ] Visual checks pass in 5 languages × themes × directions.
- [ ] A11y clean.
- [ ] No regressions.

## On failure
- Re-open `49-landing-shell-hero-header-footer.md`; fix; rerun.
- Do NOT advance to prompt 51 until this validation passes.
