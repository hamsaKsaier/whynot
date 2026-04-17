# Landing Page Redesign — Foundation: Motion Primitives, Tokens, Test Harness

## Agent

No dedicated agent exists in `.claude/agents/` yet. Use the **`landing-page-optimization`** skill as the primary driver and consult the skills listed below. If this work continues beyond the 6-prompt arc, promote a `frontend-animator` agent into `.claude/agents/`.

## Skills

- Primary: `.claude/skills/landing-page-optimization/`
- Design system: `.claude/skills/shadcn-design-system-compliance/`
- Tokens & theming: `.claude/skills/theme-factory/`
- Rules (non-negotiable): `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/switch-component-styling.md`, `.claude/rules/spec-driven-development.md` (Docker-only).

## Task

The landing page currently has **no animation library** — only Tailwind transitions and a single `useScrollReveal` Intersection-Observer hook. Before any component is rebuilt, we must introduce a shared, accessible, RTL-aware, reduced-motion-safe animation foundation that every downstream component prompt (01–05) imports from. No user-facing component is rewritten in this prompt; this is pure infrastructure.

This prompt also stands up the Playwright visual-regression harness that every downstream prompt will extend.

**Why it matters:** without a shared foundation, each component prompt would re-implement stagger/reveal/parallax patterns inconsistently, bundle size would balloon, and reduced-motion / RTL bugs would proliferate across 15 components.

### 1. Install and pin `framer-motion`

- Via Docker only: `make shell-client npm install framer-motion@<latest-stable>`. Verify current stable via Context7 MCP or web search before installing (the version the prompt-author saw may be stale).
- Confirm tree-shakeable imports work (`import { motion } from "framer-motion"` must not drag the full bundle in a vite build).
- Add bundle-size budget check: landing route's initial JS must not grow by more than 35 KB gzipped after this prompt.

### 2. Shared reduced-motion + direction utilities

Create `frontend/src/lib/motion/prefers-reduced-motion.ts`:
- `useReducedMotion()` hook that listens to the `(prefers-reduced-motion: reduce)` media query.
- Re-export framer-motion's `useReducedMotion` if shape matches, otherwise wrap it so we have a single project-local import path.

Create `frontend/src/lib/motion/direction.ts`:
- `useMotionDirection()` returns `1` for LTR and `-1` for RTL (reads `document.documentElement.dir`).
- Used by Parallax / slide primitives so horizontal motion flows with reading direction in Arabic.

### 3. Motion primitives

Create `frontend/src/components/motion/` with:

- `FadeIn.tsx` — opacity 0 → 1 on `whileInView`, `viewport={{ once: true, margin: "0px 0px -10% 0px" }}`.
- `SlideIn.tsx` — configurable `from` prop (`"top" | "bottom" | "start" | "end"`). `"start"/"end"` respect RTL via `useMotionDirection`.
- `Stagger.tsx` — parent that sequences children with configurable `delay` (default 80ms) and `stagger` (default 60ms).
- `Reveal.tsx` — thin wrapper over `FadeIn` + `SlideIn` matching the existing `useScrollReveal` visual (opacity + translateY 8px). This is the drop-in replacement for the current hook's consumers.
- `Parallax.tsx` — uses framer-motion `useScroll` + `useTransform` for background/image parallax. Respects `prefers-reduced-motion` by disabling transform entirely.
- `Marquee.tsx` — infinite horizontal loop for TrustBar; pauses on `hover` and `focus-within`; `dir="rtl"` flips direction; reduced-motion renders a static flex grid.
- `CountUp.tsx` — animates a number from 0 to target via framer-motion `animate()`; `Intl.NumberFormat` with current locale; reduced-motion shows final value immediately.

**Every primitive must:**
- Accept `className`, `as` (polymorphic element, default `div`), and pass rest props through to the underlying `motion.*` element.
- Be fully typed (no `any`). Export prop types.
- Have a `data-motion="{primitive-name}"` attribute so tests can query without hooking into animation state.
- Degrade to a plain element when `useReducedMotion()` returns `true` — opacity/translate/scale all set to the final state with no transition.
- Honor Uncodixify: no `translate-y` on hover, no `scale-*`, no shadow escalation. The primitives themselves only animate *into view* — they do NOT wire up hover effects.

### 4. Motion presets

Create `frontend/src/lib/motion/presets.ts`:
- Export named easing arrays: `easeOutExpo`, `easeInOutCubic`, `springSmooth`, `springSnappy`.
- Export named durations in seconds: `fast` (0.15), `base` (0.2), `slow` (0.4). Max duration enforced ≤ 0.4s per Uncodixify.
- Export named `Variants` objects used by primitives so consumers can compose without re-declaring.

### 5. Upgrade `useScrollReveal`

`frontend/src/hooks/useScrollReveal.ts` currently powers several landing sections. Rewrite it as a **backward-compatible shim** over `Reveal` + `useInView` from framer-motion:
- Same return shape (`{ ref, isVisible }`).
- Same `threshold` option.
- Internally uses framer-motion's `useInView`.
- Existing tests in `frontend/src/hooks/__tests__/useScrollReveal.test.ts` must still pass unchanged.

### 6. Tailwind token extensions

Extend `frontend/tailwind.config.ts`:
- No new shadow steps (Uncodixify forbids `shadow-md`/`-lg` escalation — `shadow-sm` is the ceiling).
- Add `transitionTimingFunction` entries mirroring the preset easings.
- Add a `blur-xs` / `blur-sm` token only if needed by parallax backdrops (no glassmorphism — parallax uses solid color layers).
- Confirm all additions compile clean with `make shell-client npm run build`.

### 7. Playwright visual-regression harness for the landing

Create `frontend/e2e/landing/` with:
- `landing.visual.spec.ts` — snapshots `/` at 5 viewports (`360x740` mobile, `768x1024` tablet, `1024x768` tablet-landscape, `1440x900` desktop, `1920x1080` wide) × 2 themes (light/dark) × 2 directions (LTR = en, RTL = ar). That's 20 baseline screenshots.
- `landing.motion.spec.ts` — asserts that with `prefers-reduced-motion: reduce` emulated, no element has a `transform` other than `none` after the in-view animation window elapses.
- `landing.a11y.spec.ts` — `@axe-core/playwright` run on `/` in every locale; zero critical violations.
- Place baselines under `frontend/e2e/landing/__screenshots__/` and gitignore volatile OS-level font-rendering diffs via `maxDiffPixelRatio: 0.01`.

Update `frontend/playwright.config.ts` only if a new project is needed (e.g., RTL project pointing at `?lng=ar`); otherwise reuse existing projects.

### 8. Vitest coverage

- New `frontend/src/components/motion/__tests__/` with one test file per primitive. Each test covers: renders children, applies `data-motion` attr, passes className, reduced-motion path bypasses motion props, polymorphic `as` prop works.
- `frontend/src/lib/motion/__tests__/` for hooks: `prefers-reduced-motion.test.ts`, `direction.test.ts`, `presets.test.ts` (exported constants unchanged to prevent accidental regression).
- Coverage must remain at the repo's **100%** threshold configured in `frontend/vitest.config.ts`. No lowering thresholds.

### Tests

**Vitest (required cases):**
- `FadeIn`: renders child; `data-motion="fade-in"`; with `prefers-reduced-motion`, final opacity 1 applied without transition; `as="section"` renders a `<section>`.
- `SlideIn`: all 4 `from` directions; RTL flips `start`/`end`; reduced-motion disables transform.
- `Stagger`: children animate with correct delay sequence (verify via mock framer-motion `variants` calls, or by inspecting the generated `transition.delay` on each child ref).
- `Reveal`: backward compat with prior `useScrollReveal` consumers — snapshot should match prior output when reduced motion is on.
- `Parallax`: scroll simulation moves element; reduced-motion = no transform.
- `Marquee`: pauses on `mouseenter`; RTL reverses animation direction; reduced-motion renders static grid (no `animation` style).
- `CountUp`: ends at target number; uses `Intl.NumberFormat` with current `i18n.language`; reduced-motion shows final immediately.
- `useReducedMotion`: reacts to `matchMedia` change events.
- `useMotionDirection`: reads `document.documentElement.dir`; updates when it changes.
- `useScrollReveal` shim: existing tests pass untouched.

**Playwright:**
- `landing.visual.spec.ts` snapshots at all 20 combinations listed in §7.
- `landing.motion.spec.ts` — reduced-motion path has no transforms post-animation.
- `landing.a11y.spec.ts` — zero critical axe violations across 5 locales.

**Coverage gate:** 100% lines/branches/functions/statements on all new files under `frontend/src/components/motion/` and `frontend/src/lib/motion/`.

### i18n

No new translation keys are introduced in this prompt — primitives are presentational. However:

- `CountUp` must format numbers via `Intl.NumberFormat(i18n.language)` so `1000` becomes `1,000` in en, `١٬٠٠٠` in ar, `1 000` in fr, `1.000` in de, `1.000` in es.
- Add a Vitest matrix for `CountUp` iterating `['en', 'ar', 'fr', 'de', 'es']` and asserting the rendered string matches `Intl.NumberFormat(lang).format(target)`.
- `Marquee` direction verified in ar (RTL) via Playwright snapshot diff against en.
- No backend messages touched.

### Documentation

Not applicable — foundation primitives are internal. Downstream prompts (`02`–`05`) carry user-facing docs where relevant.

### Verification before marking done

- [ ] `make shell-client npm run typecheck` — zero errors.
- [ ] `make shell-client npm run lint` — zero warnings.
- [ ] `make shell-client npm run test` — 100% coverage on new files.
- [ ] `make shell-client npm run test:e2e -- landing/` — all 20 visual baselines captured; motion + a11y specs green.
- [ ] Bundle-size check: landing route JS grew ≤ 35 KB gzipped.
- [ ] All existing tests (including `useScrollReveal.test.ts`) still pass.

### Notes on project conventions referenced

- `.claude/rules/uncodixify-ui.md` — no `hover:-translate-y-*`, no `hover:shadow-md`, no `animate-bounce`, no `rounded-full` on containers, max `duration-200`.
- `.claude/rules/rtl-support-arabic.md` — use logical properties; do NOT use `rtl:flex-row-reverse` (native `dir="rtl"` handles row reversal).
- `.claude/rules/switch-component-styling.md` — not triggered here but binding for future prompts.
- Docker-only: every command above runs via `make shell-client`.
