# Install Shadcn, STYLES.md, dark-mode + RTL scaffolding, and the DesignSystemPage

## Agent
`design-ui-designer` (lead) + `design-ux-architect` (consult) + skill `shadcn-design-system-compliance`

## Depends on
`02-validate-architecture-md.md`, `04-validate-claude-and-opencode-assets.md`, `06-validate-test-infrastructure.md`

## Goal
Lay the design-system foundation in both frontends (`frontend/` and `admin-frontend/`). Install Shadcn (zinc base, CSS variables), port `STYLES.md` from the reference, wire dark-mode toggle, scaffold `<html lang dir>` for later RTL, and add a `DesignSystemPage` showcasing every token + primitive. **No existing pages are rewritten in this prompt** — the rewrite happens in phases 2–3.

## Reference
- `ARCHITECTURE.md` section 7.
- `/home/serverlessbase/serverless-v2/STYLES.md`
- `/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/components.json`
- `/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/tailwind.config.ts`
- Skill: `.claude/skills/shadcn-design-system-compliance/`

## Task

### 1. Port and adapt `STYLES.md`
Copy `/home/serverlessbase/serverless-v2/STYLES.md` to `/home/serverlessbase/whynot/STYLES.md`. Adapt:
- Rebrand from `serverlessbase` → `whynot`.
- Keep oklch color space.
- Adjust the accent palette to reflect whynot's existing brand (inspect `frontend/src/index.css` or the current Tailwind config for the current primary color; the migration should preserve brand identity even while changing the underlying tokens). If the existing brand is "sky blue," derive oklch values that approximate it.
- Document: light + dark palettes; typography scale; selection colors (WCAG 2.1 AA); status colors (destructive, success, warning, info); focus ring.
- Add a "Do not hardcode hex" rule, enforced by stylelint (installed in step 6).

### 2. Install Shadcn in both apps
Use the official CLI inside Docker — no host node:

```bash
docker compose run --rm frontend bash -c 'bunx shadcn@latest init --base-color zinc --css-variables --typescript'
docker compose run --rm admin-frontend bash -c 'bunx shadcn@latest init --base-color zinc --css-variables --typescript'
```

This generates `components.json`, `src/lib/utils.ts` (with `cn()`), and scaffolds `src/components/ui/`.

Add the following Shadcn primitives via `bunx shadcn@latest add`:
- `button`, `input`, `label`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- `card`, `dialog`, `sheet`, `popover`, `tooltip`, `dropdown-menu`, `context-menu`, `command`
- `tabs`, `accordion`, `collapsible`
- `alert`, `alert-dialog`, `toast` (`sonner` variant)
- `badge`, `separator`, `skeleton`, `scroll-area`, `progress`
- `table`, `pagination` (custom), `data-table` (via `@tanstack/react-table`)
- `form` (with `react-hook-form` + `zod`)
- `avatar`, `calendar`, `date-picker` (custom), `combobox`
- `navigation-menu`, `breadcrumb`, `sidebar`

All go under `src/components/ui/`.

### 3. `tailwind.config.ts` — oklch tokens, `.dark` class, RTL-friendly defaults
Replace each app's Tailwind config with a config that:
- Declares the full light and dark palettes as CSS variables in `src/styles/globals.css` (or `src/index.css`) using oklch.
- Sets `darkMode: ['class']`.
- Extends `theme.colors` to reference the CSS variables (e.g., `primary: 'hsl(var(--primary))'` or oklch equivalents).
- Adds plugin `tailwindcss-rtl` OR enables logical properties via `tailwindcss-logical` (whichever is more widely supported at time of writing; prefer logical properties).
- Container queries: enable via `@tailwindcss/container-queries`.
- Font families: match `STYLES.md` (ABeeZee + Abhaya Libre or whynot's existing brand fonts — verify first).
- Mobile-first breakpoints: `sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px` (Tailwind defaults).

### 4. Dark-mode toggle + persistence
Create:
- `frontend/src/hooks/useTheme.ts` — React hook returning `{ theme, setTheme, toggle }` backed by `localStorage.theme` with prefers-color-scheme fallback.
- `frontend/src/components/ThemeProvider.tsx` — context provider wraps `<App />`, adds/removes `.dark` class on `<html>`.
- Same files in `admin-frontend/`.
- A small `ThemeToggle` button in `src/components/ui/theme-toggle.tsx` using the `sun`/`moon` Lucide icons from Shadcn's default icon set.

### 5. RTL scaffolding
- Add `<html lang="en" dir="ltr">` to `index.html` in both apps.
- Create `frontend/src/hooks/useDirection.ts` — reads current i18n language and returns `'rtl'` if `ar`, else `'ltr'`. (i18n itself lands in phase 4; this hook currently reads a stub `localStorage.i18nextLng` or defaults to `en`.)
- Wrap `<App />` in a `<DirectionProvider>` that calls `document.documentElement.setAttribute('dir', direction)` whenever direction changes.
- Prefer Tailwind logical properties throughout (`ms-`, `me-`, `ps-`, `pe-` over `ml-`, `mr-`, `pl-`, `pr-`) so that the rewrite in phase 2 doesn't need a second pass for RTL.

### 6. stylelint + enforcement of "no hardcoded hex"
Install `stylelint`, `stylelint-config-standard`, `stylelint-config-recess-order`. Add a rule that fails on any literal hex color (`#...`) outside of `tailwind.config.ts` and `globals.css`:
```json
{
  "rules": {
    "color-no-hex": true
  }
}
```
Add to the test pipeline from prompt 05 as a separate job `stylelint`.

### 7. `DesignSystemPage` under both apps
Create `frontend/src/pages/DesignSystemPage.tsx` and `admin-frontend/src/pages/DesignSystemPage.tsx` rendering a single-scroll showcase of every token + primitive:

- **Tokens** section: swatches of every color variable (light + dark side-by-side), every font size, every font weight, every radius, every shadow, focus ring.
- **Primitives** section: one live example of every Shadcn component added in step 2, each with a short label.
- **States** section: hover, focus, disabled, error, success variants.
- **Dark/RTL toggles** at the top, affecting the page directly.

Gate the route behind a dev-only URL (`/__design`) or a superadmin flag; it is not a production-user-facing page.

### 8. Update `ARCHITECTURE.md`
- Section 7 (Frontend architecture): add a link to `STYLES.md`, note the Shadcn base color (`zinc`), dark-mode mechanism, RTL scaffolding, `DesignSystemPage` route.
- Section 2: add `STYLES.md` row if not present.

### Files to create/modify
- `/home/serverlessbase/whynot/STYLES.md` — new.
- `frontend/components.json`, `frontend/tailwind.config.ts`, `frontend/src/styles/globals.css` (or `index.css`).
- `frontend/src/components/ui/**` — generated Shadcn primitives.
- `frontend/src/lib/utils.ts` — the `cn()` helper.
- `frontend/src/hooks/useTheme.ts`, `frontend/src/hooks/useDirection.ts`.
- `frontend/src/components/ThemeProvider.tsx`, `frontend/src/components/DirectionProvider.tsx`, `frontend/src/components/ui/theme-toggle.tsx`.
- `frontend/src/pages/DesignSystemPage.tsx`.
- All the above duplicated in `admin-frontend/` with appropriate path adjustments.
- `stylelint.config.cjs` + `.stylelintignore` at repo root OR per-app.
- `ARCHITECTURE.md` — section 7 updated.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`
- `services/qa-loop-executor/src/mcp-browser.ts`
- `services/database/migrations/`

### Tests
- **Vitest unit**: `frontend/src/components/ui/__tests__/button.test.tsx`, one test file per primitive, asserting `render` does not throw and `toHaveClass('...')` for the expected variant. At least: button, input, card, dialog, tabs, table.
- **Vitest hook**: `frontend/src/hooks/__tests__/useTheme.test.ts` — toggles light/dark, persists to localStorage, reads initial value correctly.
- **Vitest hook**: `useDirection.test.ts` — returns `rtl` for `ar`, `ltr` otherwise.
- **Playwright**: `frontend/e2e/design-system.spec.ts` — opens `/__design`, takes 4 screenshots (light-ltr, dark-ltr, light-rtl, dark-rtl). Visual diff threshold documented.
- **Stylelint**: zero hex colors outside allowed files.
- **Regression**: re-run smoke tests from prompt 05; still passing.

### i18n
- N/A direct. BUT the `DesignSystemPage` labels should already use `t()` keys (placeholders are OK; full 5-language fill lands in prompt 19).
- RTL scaffolding is wired so phase 4 can flip direction with zero additional frontend work.

### Documentation
- Update `STYLES.md` itself (the doc).
- `/docs/design-system.md` — English only for now (5-language version lands in prompt 19).
  Short sections: tokens, dark mode, RTL, mobile-first, "do not hardcode hex."

### Acceptance criteria
- [ ] `STYLES.md` exists at repo root and matches the adapted palette.
- [ ] Both apps have `components.json` + populated `src/components/ui/`.
- [ ] Both apps have `tailwind.config.ts` with `darkMode: ['class']` and oklch palettes.
- [ ] `useTheme` persists to `localStorage.theme`; `.dark` class appears on `<html>` when dark.
- [ ] `useDirection` toggles `document.documentElement.dir`.
- [ ] `/__design` route renders in both apps and shows every primitive.
- [ ] All vitest unit tests pass; stylelint passes; Playwright screenshots generated without visual regressions.
- [ ] `ARCHITECTURE.md` section 7 updated.
- [ ] No changes to untouchable paths.
