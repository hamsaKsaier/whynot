# 09 — Light Mode: Logo Variants & Theme Parity

## Agent
`design-brand-guardian`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- STYLES.md

## Task

Light mode quality is poor. The biggest visual regression is that the single logo asset (`frontend/public/logo.svg` and `admin-frontend/public/logo.svg`) uses `fill="#F8FAFC"` (near-white) and `fill="#0EA5E9"` (sky blue). On light backgrounds the near-white portions vanish. Additionally, several components hardcode `text-white`, `bg-white`, `bg-black` and won't flip with the theme.

### Scope / Requirements

1. **Logo variants**
   - Produce two canonical SVG files per surface:
     - `frontend/public/logo-light.svg` — dark ink on transparent, suitable for light backgrounds.
     - `frontend/public/logo-dark.svg` — light ink on transparent, suitable for dark backgrounds.
     - Same treatment for `admin-frontend/public/logo-light.svg` and `admin-frontend/public/logo-dark.svg`.
   - Keep sky-blue primary mark (`oklch(0.685 0.155 220)` ≈ `#0EA5E9`) consistent across both variants for brand recognition.
   - Ensure SVG `viewBox`, `width`, `height`, and aspect ratio are identical across variants.
   - Optimize with `svgo` inside Docker (`make shell-client npx svgo ...`).
   - Delete the ambiguous `logo.svg` **only** after all consumers are migrated to the new `<Logo />` component.

2. **`<Logo />` React component**
   - Create `frontend/src/components/ui/Logo.tsx` and `admin-frontend/src/components/ui/Logo.tsx` (shared source pattern — duplicate or put in a shared package).
   - Reads the current theme via `useTheme()` (or equivalent from next-themes / shadcn theme provider).
   - Swaps `src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}`.
   - Props: `className`, `size` (sm/md/lg), `variant` (`"full" | "mark"`).
   - Respects `prefers-color-scheme` on first render (SSR-safe — avoid hydration flicker by reading the theme cookie/attribute before paint).
   - Includes `alt="whynot"` and `aria-label` for accessibility.

3. **Replace every `<img src="/logo.svg" />` reference**
   - `grep -rn 'logo\.svg\|logo\.png' frontend/src admin-frontend/src` → replace each with `<Logo />`.
   - Update favicons and PWA manifest icons if they also need light/dark variants (probably just keep the primary brand mark).

4. **Theme parity audit — non-logo**
   - Grep for `text-white`, `bg-white`, `bg-black`, `text-black` in `frontend/src/**` and `admin-frontend/src/**`.
   - Replace with semantic tokens: `text-foreground`, `bg-background`, `bg-card`, `text-card-foreground`, `bg-popover`, etc.
   - Grep for hardcoded hex in component files (`#[0-9a-fA-F]{3,8}` inside `.tsx`/`.ts`) and replace with tokens.
   - Grep for `dark:` variants missing on status colors (Tailwind scale colors like `bg-green-50` without `dark:bg-green-900/20`) and add them.

5. **Contrast audit**
   - Run a Playwright script that loads every page in light mode and uses axe-core or pa11y to assert WCAG 2.1 AA contrast (4.5:1 for normal text, 3:1 for large text).
   - Fail with file/element selector for any failing text.
   - Repeat for dark mode.

6. **Landing page hero**
   - Landing hero often sits on a dark/gradient background with light text. After prompt 07 removes the gradient, ensure the hero still looks sharp on `bg-background` (light) and `bg-background` (dark). Adjust hero typography weight/size if needed.

### Tests (MANDATORY — 100% coverage)
- **Unit**: `Logo.tsx` renders the correct asset for light and dark themes, supports SSR without hydration mismatch, handles `size` and `variant` props.
- **Integration**: every page that includes `<Logo />` is snapshot-tested in both themes.
- **Contrast test**: Playwright + axe-core runs on every route in light mode AND dark mode — zero violations (critical + serious).
- **Theme toggle**: e2e test toggles light↔dark and asserts the logo swaps visibly and the page has no `text-white`/`bg-white`/`bg-black` computed styles on non-themed surfaces.
- **Edge cases**: `prefers-color-scheme: light` on first load, no-JS fallback (logo should still render — can use `<picture>` with media queries as a progressive-enhancement alternative).

### i18n (5 languages)
- Logo alt text: localized via `t('common.logoAlt')` = "whynot" in every language (brand name is not translated, but alt text "whynot — AI QA platform" is).
- No RTL-specific logo flipping (logos are generally not mirrored in RTL per industry convention).

### Documentation
- `/docs/en/design/logo-usage.md` — logo guidelines, light vs dark variants, clear space, minimum size, incorrect usages.
- `/docs/{ar,fr,de,es}/design/logo-usage.md`.
- Add a link from the brand guidelines skill (`.claude/skills/brand-guidelines/`) to this doc.

### Constraints
- Docker-only: `make shell-client`, `make shell-admin`.
- SVGs minified via `svgo` but keep `aria-label` / `<title>` if present.
- Never bundle logo as data-URI in CSS (keep as static asset for caching).
- Respect STYLES.md — sky blue (`#0EA5E9`) stays the primary mark color across themes.
- No hardcoded hex in component files.

### Verification steps
1. `make shell-client npm run typecheck && make shell-client npm run lint && make shell-client npm test`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test`
3. `make shell-client npm run test:a11y` (axe contrast suite)
4. `make start` → `http://localhost:5183`, toggle theme, verify logo swaps and remains visible on both backgrounds.
5. Same check on `http://localhost:5184`.
6. `grep -rEn 'text-white|bg-white|bg-black|#[0-9a-fA-F]{6}' frontend/src admin-frontend/src --include="*.tsx"` returns zero hits outside of `theme.ts`/`tokens.css`.
