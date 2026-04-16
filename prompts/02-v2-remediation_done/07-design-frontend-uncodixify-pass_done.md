# 07 — Design System: Frontend Uncodixify Pass

## Agent
`design-ui-designer`

## Skills referenced
- `.claude/skills/shadcn-design-system-compliance/`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/rtl-support-arabic.md`
- STYLES.md

## Task

Despite `prompts/01-v2-migration/` marking the frontend rewrite as `_done`, many components still use "old design" patterns that violate STYLES.md and `.claude/rules/uncodixify-ui.md`. Sweep `frontend/src/**` and bring every component in line with the canonical design system.

**Concrete known violations** (non-exhaustive — audit will find more):

| File | Line | Violation |
|------|------|-----------|
| `frontend/src/components/common/Card.tsx` | 24 | `hover:shadow-md hover:border-primary-700 hover:scale-[1.01]` (lift + scale + shadow escalation) |
| `frontend/src/pages/HomePage.tsx` | 121 | `hover:shadow-md transition-shadow` on recent sessions card |
| `frontend/src/pages/HomePage.tsx` | 186 | `shadow-md hover:shadow-lg rounded-xl` on CTA button |
| `frontend/src/pages/HomePage.tsx` | 74, 114, 130, 160, 163 | `text-white` hardcoded (won't theme) |
| `frontend/src/pages/HomePage.tsx` | ~130 | `rounded-2xl` on hero (forbidden) |
| `frontend/src/pages/HomePage.tsx` | — | `bg-gradient-to-br` hero background |
| `frontend/src/pages/PublicScanResultsPage.tsx` | — | `bg-gradient-to-br` + `backdrop-blur-sm` (glassmorphism) |
| `frontend/src/pages/LandingPage.tsx` | — | `backdrop-blur-sm` navigation |
| `frontend/src/pages/MonitorsPage.tsx` | — | `bg-sky-600 text-white` instead of semantic tokens |
| `frontend/src/pages/WebhookManagementPage.tsx` | — | `bg-black bg-opacity-50` hardcoded |
| `frontend/src/components/FlowNodes/ProjectNode.tsx` | 14 | `transition-all duration-200 hover:shadow-md` |
| `frontend/src/components/FlowNodes/TestCaseNode.tsx` | 32 | `transition-all duration-200 hover:shadow-md` |
| `frontend/src/components/FlowNodes/*.tsx` (6 files) | various | `transition-all duration-200` |
| `frontend/src/components/common/TestGenerationLoader.tsx` | — | `transition-all duration-300` |
| `frontend/src/components/TestRunner/TestExecutionView.tsx` | — | `ml-2` (physical), missing `rtl:scale-x-[-1]` on arrows |
| `frontend/src/components/Billing/TransactionHistory.tsx` | — | `text-left`, `text-right` (physical) |

In total: ~36 `transition-all`, ~10 `hover:shadow-md`, several gradient/glassmorphism patches, dozens of physical directional classes.

### Scope / Requirements

1. **Full audit**
   - Static scan `frontend/src/**/*.{ts,tsx}` for every forbidden pattern listed in `.claude/rules/uncodixify-ui.md`:
     - `hover:-translate-y-*`, `hover:translate-*`, `hover:scale-*`
     - `hover:shadow-md`, `hover:shadow-lg`, `hover:shadow-xl`
     - `animate-bounce`, `animate-pulse` (except on `Skeleton`), `animate-ping` (non-notification)
     - `transition-all`, `duration-300`, `duration-500`, `duration-700`, `duration-1000`
     - `rounded-2xl`, `rounded-3xl`, `rounded-full` on containers/cards (allowed on avatars/icon-buttons)
     - `bg-gradient-to-*`, `bg-clip-text text-transparent`
     - `backdrop-blur`, `backdrop-filter`
     - `ring-2 ring-offset-2` on cards (use `ring-1 ring-primary`)
     - `shadow-xl`, `shadow-2xl` in app UI
   - Also scan for:
     - Hardcoded colors: `bg-[#...]`, `text-[#...]`, `style={{ color: '#...' }}`, `bg-white`, `text-white`, `bg-black`, `text-black`, `bg-gray-*`, `text-gray-*` (prefer semantic tokens).
     - Physical directional classes: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*`, `rounded-l-*`, `rounded-r-*`.
     - Missing `rtl:scale-x-[-1]` on directional icons from `MIRROR_ICONS` (`ArrowRight`, `ArrowLeft`, `ChevronLeft`, `ChevronRight`, `LogIn`, `LogOut`, `ExternalLink`, `Reply`, `Forward`, `Share`, `Undo`, `Redo`, `SkipBack`, `SkipForward`, `MoveLeft`, `MoveRight`).
     - `rtl:flex-row-reverse` (forbidden because native `dir="rtl"` handles it).
   - Produce a violation report (file:line:pattern) before fixing, attached to the PR.

2. **Fix each violation**
   - `hover:-translate-y-*` / `hover:scale-*` → `hover:bg-muted/50` or `hover:border-primary/50`.
   - `hover:shadow-md` → remove (cards stay `shadow-sm` or `shadow-none`).
   - `animate-bounce` → remove.
   - `animate-pulse` on badges/buttons → remove.
   - `transition-all` → `transition-colors` or `transition-opacity`.
   - `duration-300`+ → `duration-150` (or `duration-200` max).
   - `rounded-2xl` / `rounded-3xl` → `rounded-lg`.
   - `rounded-full` on containers → `rounded-lg`.
   - `bg-gradient-*` → solid `bg-background` / `bg-muted` / `bg-card`.
   - `bg-clip-text text-transparent` → `text-foreground` or semantic color.
   - `backdrop-blur*` → solid `bg-card` / `bg-popover`.
   - `text-white` / `bg-white` → `text-foreground` / `bg-background` / `bg-card`.
   - `bg-black` → `bg-foreground` or token-appropriate.
   - Hardcoded hex → find the nearest semantic token in STYLES.md.
   - Physical classes → logical equivalents.
   - Missing icon mirroring → add `rtl:scale-x-[-1]` via `cn()`.
   - `rtl:flex-row-reverse` → remove entirely.

3. **FlowNodes special case** (6 files in `frontend/src/components/FlowNodes/`)
   - Replace `transition-all duration-200 hover:shadow-md` with `transition-colors duration-150 hover:bg-muted/50`.
   - Keep `shadow-sm` static.
   - Verify ReactFlow's own node styles aren't overridden with forbidden patterns.

4. **Card component special case** (`frontend/src/components/common/Card.tsx:24`)
   - Remove `hover:scale-[1.01]`, `hover:shadow-md`, `hover:border-primary-700`.
   - Use `hover:bg-muted/50` instead.
   - Ensure all consumers still render correctly — run full visual regression.

5. **Landing pages**
   - `LandingPage.tsx`, `HomePage.tsx`, and section components must drop all gradients, glassmorphism, and `text-white` overrides.
   - Replace hero backgrounds with solid `bg-background` or subtle `bg-muted`. Add a small geometric pattern via SVG if decoration is required (no gradients).

6. **Lint enforcement**
   - Add an ESLint rule or a custom Biome lint that fails on the banned patterns.
   - Wire it into `make shell-client npm run lint` so CI catches regressions.

### Tests (MANDATORY — 100% coverage for touched files)
- **Static scan test**: `frontend/src/__tests__/design-system-compliance.test.ts` — scans `src/**/*.tsx` and fails on any forbidden pattern listed above. Runs in CI.
- **Visual regression**: Playwright snapshots for the 10 most-visited routes (home, dashboard, projects, runner, results, settings, billing, landing, login, signup) in light mode at 1280x800 and 375x667. Before/after diffs attached to PR.
- **Dark mode parity**: every route rendered in `.dark` must pass the same visual regression suite with no invisible/low-contrast elements. Use a color-contrast Playwright plugin to verify WCAG 2.1 AA.
- **RTL parity**: every route rendered with `lang=ar` must pass visual regression with mirrored layout and correctly oriented directional icons.
- **Unit**: for every refactored component, assert its rendered className doesn't contain any banned pattern.
- **Edge cases**: focus rings visible (`:focus-visible` outline), `prefers-reduced-motion` respects `transition-colors` (not disabled, since it's subtle), 44x44 touch targets preserved on mobile.

### i18n (5 languages)
- No new strings expected from this pass, but any refactor that touches JSX must wrap strings in `t()` if they aren't already (coordinate with prompt 01).
- Run the language switcher across the refactored pages in each of the 5 languages and confirm layout still holds (long German words especially — coordinate with prompt 04).
- No RTL regressions.

### Documentation
- `/docs/en/design/uncodixify-audit.md` — summary of the sweep, remaining acceptable deviations (if any), how to onboard new contributors to the rules.
- 5-language variants: `/docs/{ar,fr,de,es}/design/uncodixify-audit.md`.

### Constraints
- Docker-only: `make shell-client`.
- Every style change must map to a STYLES.md token or pattern. No new hex values.
- Never introduce new shadcn overrides without updating `components.json`.
- Respect `.claude/rules/spec-driven-development.md` — full Spec Kit workflow for large refactors.
- No functional behavior changes — pure style cleanup.

### Verification steps
1. `make shell-client npm run typecheck`
2. `make shell-client npm run lint`
3. `make shell-client npm test`
4. `make shell-client npm test -- design-system-compliance`
5. `make shell-client npm run test:visual` (Playwright)
6. `make rtl-check`
7. Manual smoke: `make start`, visit every route in light and dark modes, switch through all 5 languages, compare against the pre-refactor screenshots attached to the PR.
8. `grep -rEn "hover:-translate-y|hover:shadow-md|hover:shadow-lg|animate-bounce|rounded-2xl|rounded-3xl|bg-gradient-to|backdrop-blur|transition-all" frontend/src` returns zero hits.
