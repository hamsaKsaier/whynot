# Validate: Shadcn design system foundation is in place

## Agent
`design-ui-designer` (verifier)

## Depends on
`07-install-shadcn-and-design-tokens.md`

## Goal
Verify Shadcn is installed in both apps, dark mode + RTL scaffolding works, `STYLES.md` is authoritative, the DesignSystemPage renders, and stylelint blocks hardcoded hex.

## Validation steps

### 1. File structure
```bash
cd /home/serverlessbase/whynot
test -f STYLES.md || exit 1
for app in frontend admin-frontend; do
  test -f $app/components.json || exit 1
  test -f $app/tailwind.config.ts || exit 1
  test -d $app/src/components/ui || exit 1
  test -f $app/src/lib/utils.ts || exit 1
  test -f $app/src/hooks/useTheme.ts || exit 1
  test -f $app/src/hooks/useDirection.ts || exit 1
  test -f $app/src/components/ThemeProvider.tsx || exit 1
  test -f $app/src/components/DirectionProvider.tsx || exit 1
  test -f $app/src/pages/DesignSystemPage.tsx || exit 1
done
```

### 2. Primitives are complete
For each app, assert at least these files exist under `src/components/ui/`:
`button.tsx, input.tsx, label.tsx, textarea.tsx, select.tsx, checkbox.tsx, radio-group.tsx, switch.tsx, card.tsx, dialog.tsx, sheet.tsx, popover.tsx, tooltip.tsx, dropdown-menu.tsx, tabs.tsx, accordion.tsx, alert.tsx, alert-dialog.tsx, badge.tsx, separator.tsx, skeleton.tsx, scroll-area.tsx, progress.tsx, table.tsx, form.tsx, avatar.tsx, command.tsx, navigation-menu.tsx, breadcrumb.tsx, theme-toggle.tsx`

### 3. Tailwind config uses class-based dark mode
```bash
for app in frontend admin-frontend; do
  grep -q "darkMode: \['class'\]" $app/tailwind.config.ts \
    || grep -q 'darkMode: "class"' $app/tailwind.config.ts \
    || { echo "$app missing darkMode class"; exit 1; }
done
```

### 4. `globals.css` / `index.css` uses oklch CSS variables
```bash
for app in frontend admin-frontend; do
  f=$(ls $app/src/styles/globals.css $app/src/index.css 2>/dev/null | head -1)
  grep -q 'oklch(' "$f" || { echo "$f missing oklch"; exit 1; }
  grep -q ':root' "$f" || exit 1
  grep -q '\.dark' "$f" || exit 1
done
```

### 5. Stylelint catches hex and passes on allowed files
```bash
cd /home/serverlessbase/whynot
docker compose -f docker-compose.test.yml run --rm frontend-test bunx stylelint "frontend/src/**/*.{css,tsx}" || exit 1
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bunx stylelint "admin-frontend/src/**/*.{css,tsx}" || exit 1
```

### 6. Vitest unit tests for primitives + hooks
```bash
docker compose -f docker-compose.test.yml run --rm frontend-test bun vitest run --coverage src/components/ui src/hooks || exit 1
docker compose -f docker-compose.test.yml run --rm admin-frontend-test bun vitest run --coverage src/components/ui src/hooks || exit 1
```
All tests green; coverage for files touched in prompt 07 at 100%.

### 7. Playwright DesignSystemPage screenshots
```bash
docker compose -f docker-compose.test.yml run --rm playwright bunx playwright test frontend/e2e/design-system.spec.ts \
  --project chromium-desktop-ltr-light --project chromium-desktop-ltr-dark || exit 1
# Assert screenshots written.
ls frontend/e2e/__screenshots__/design-system-*.png | wc -l | grep -q '[1-9]'
```
At least 4 screenshots (light-ltr, dark-ltr, light-rtl, dark-rtl). If rtl projects are not yet defined in `playwright.config.ts` (they land fully in phase 4), the 2 ltr screenshots are sufficient for this phase — document the gap.

### 8. DesignSystemPage actually renders every primitive
Use a Playwright assertion that every primitive's `data-testid` (or accessible label) is visible:
```ts
for (const p of PRIMITIVES) {
  await expect(page.getByTestId(`ds-${p}`)).toBeVisible();
}
```
PRIMITIVES = the list from step 2.

### 9. Dark mode round-trip
```ts
await page.goto('/__design');
await page.getByRole('button', { name: /theme/i }).click();
await expect(page.locator('html')).toHaveClass(/dark/);
await page.reload();
await expect(page.locator('html')).toHaveClass(/dark/); // persisted
```

### 10. `ARCHITECTURE.md` section 7 updated
```bash
grep -q 'Shadcn' ARCHITECTURE.md && grep -q 'oklch\|STYLES.md' ARCHITECTURE.md || exit 1
```

### 11. Regression: prior phases still green
```bash
docker compose -f docker-compose.test.yml run --rm gateway-test bun vitest run || exit 1
```
Smoke from prompt 05 still passes.

### 12. Untouchable paths unchanged
```bash
git diff --name-only HEAD~5..HEAD | grep -E '^services/qa-loop-executor/src/v2/|^services/qa-loop-executor/src/mcp-browser\.ts|^services/database/migrations/' \
  && { echo "untouchable path modified"; exit 1; } || true
```

## Pass criteria
- [ ] All 12 checks pass.
- [ ] All Vitest + Playwright + stylelint commands exit 0.
- [ ] At least 4 screenshots generated across theme/direction matrix.
- [ ] Dark mode persists across reload.
- [ ] `STYLES.md` exists and is referenced.
- [ ] `ARCHITECTURE.md` section 7 updated.
- [ ] No untouchable path changes.

## On failure
- Missing primitive → re-run `bunx shadcn add <name>`.
- Stylelint false positive → narrow the `.stylelintignore` to allowed files only; do not disable the rule globally.
- Screenshot diff → commit new baselines only if deliberate; otherwise fix the CSS drift.
- Re-run until green. Do NOT advance to prompt 09 until pass.
