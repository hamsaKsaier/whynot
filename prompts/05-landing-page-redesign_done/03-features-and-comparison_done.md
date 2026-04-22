# Landing Page Redesign — Trust Bar, Features & Comparison

## Agent

No agent in `.claude/agents/` yet. Use the skills below.

## Skills

- Primary: `.claude/skills/landing-page-optimization/`, `.claude/skills/shadcn-design-system-compliance/`
- Supporting: `.claude/skills/competitor-alternatives/`, `.claude/skills/copywriting/`, `.claude/skills/content-strategy/`, `.claude/skills/brand-guidelines/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/spec-driven-development.md`.

## Task

Rebuild the middle of the landing page: `TrustBar`, `FeaturesSection`, `ComparisonSection`. These sections carry the "why us" narrative — they must read effortlessly, scroll smoothly, and hold up in RTL where table layouts break most often. **Depends on `00-foundation.md`**.

### 1. TrustBar (`frontend/src/components/landing/TrustBar.tsx`)

- Full-width band under the hero. Two subsections: **trust badges** (SOC 2, data encryption, money-back guarantee, uptime SLA) + **stats row** (bugs found, tests generated, teams using, accuracy).
- **Trust badges**: infinite marquee via `<Marquee>` from foundation. Pauses on `hover`/`focus-within`. RTL: marquee flows end-to-start automatically.
- **Stats row**: four cells, each using `<CountUp>` to animate to the target number on scroll-in. Respect locale number formatting (1,234 / ١٬٢٣٤ / 1 234 / 1.234 / 1.234).
- Reduced motion: both marquee and count-up render final values statically (no motion).
- No `animate-pulse` on any badge (Uncodixify forbids it outside skeletons).

### 2. FeaturesSection (`frontend/src/components/landing/FeaturesSection.tsx`)

- Eight feature cards in a responsive grid: 1 col mobile, 2 cols `md`, 4 cols `lg`.
- Each card: lucide icon in a soft-tinted square (`bg-muted`), title, 2-line description.
- Reveal via `<Stagger stagger={60}>` with each child wrapped in `<Reveal>`.
- Hover state: border darkens + icon tint deepens — **no lift, no shadow escalation, no scale**.
- Optional tier tag ("Pro", "Managed") on applicable cards — small `Badge` with `variant="outline"`.
- Icons from lucide: keep existing (`Bot`, `Bug`, `Eye`, `Code2`, `ShieldAlert`, `Monitor`, `FileStack`, `Lock`). Symmetric icons — do NOT mirror in RTL.

### 3. ComparisonSection (`frontend/src/components/landing/ComparisonSection.tsx`)

- Table comparing WhyNot to Selenium, Cypress, Playwright, BrowserStack, LambdaTest across ~10 features.
- Values: ✓ / ✗ / "Partial" — use lucide `Check`, `X`, `Minus` icons with semantic colors (`text-green-600 dark:text-green-400`, `text-red-600 dark:text-red-400`, `text-muted-foreground`).
- **Mobile (`< md`)**: sticky first column (feature names) with horizontal scroll for competitor columns. Shadow indicators on scrollable edges to hint scrollability — implemented via a gradient-free solid pseudo-element that fades in/out based on scroll position (computed via `onScroll` handler, not CSS gradients).
- **Desktop (`md+`)**: standard table, no sticky needed.
- **WhyNot column**: highlighted with `ring-1 ring-primary` + `bg-primary/5`. NOT a gradient background.
- Reveal via `<Reveal>` as the section enters viewport.
- Icons animate in with a stagger once the row is visible — use `<Stagger>` across cells within a row, `<Stagger>` across rows at the table level.
- RTL: horizontal scroll direction flips (native `dir="rtl"` handles this); the sticky column pins to the end edge; shadow indicator on the correct edge.

### Tests

**Vitest:**
- `TrustBar`: renders 4 badges + 4 stats; `<CountUp>` reaches target for each stat in each locale; marquee pauses on `mouseenter`.
- `FeaturesSection`: renders 8 cards; each card has icon + title + description; no card uses `translate-y` or `scale` on hover (assert via computed style or class inspection).
- `ComparisonSection`: renders 6 columns (feature + 5 competitors) × N rows from the data source; WhyNot column has `ring-primary`; mobile layout has sticky first column (simulate viewport via vitest `window.innerWidth`); cell icons render the correct variant for `true`/`false`/`"partial"`.
- Reduced-motion paths for all three components.
- 100% coverage on new files.

**Playwright:**
- `e2e/landing/features.spec.ts` — all 8 cards visible in viewport after scroll; keyboard `Tab` walks through cards in DOM order; no skipped focus.
- `e2e/landing/comparison.spec.ts` — desktop: all 6 columns visible without scroll; mobile 360px: feature column sticky while competitor columns scroll horizontally; RTL at `?lng=ar` flips scroll direction.
- `e2e/landing/trust-bar.spec.ts` — stat numbers finalize to formatted locale values across en/ar/fr/de/es; marquee pauses on hover.
- A11y: table has `<th scope="col">` + `<th scope="row">`; zero critical axe violations.
- Visual regression at standard matrix.

### i18n

Existing keys (verify all 5 locales populated):

- `landing.trustBar.ariaLabel`, `.logoTitle`, `.badges.*`, `.stats.*` (bugsFound, testsGenerated, teams, accuracy, with label + value)
- `landing.features.heading`, `.subheading`, `.items.*` (aiAgents, bugDetection, visualRegression, playwrightGen, chaosTest, multiBrowser, testSuites, security — each with `title` + `description`)
- `landing.comparison.title`, `.subtitle`, `.featureColumn`, `.competitors.*` (selenium, cypress, playwright, browserstack, lambdatest), `.features.*` (row labels), `.values.yes`, `.values.no`, `.values.partial`

Likely additions:
- `landing.trustBar.stats.*.suffix` — e.g. "+" for "10,000+ bugs found". Locale-aware (Arabic may omit or use different marker).
- `landing.features.items.*.tierBadge` — optional "Pro" / "Managed" label per feature.
- `landing.comparison.mobileHint` — "Scroll to see more" for the sticky-scroll table hint on mobile.

Translation process per new key: en first, then ar/fr/de/es with quality review. Update Vitest i18n tests.

**Backend messages**: none — these sections are content-driven only.

**RTL critical points:**
- Comparison table: feature column sticks to the end edge in RTL; horizontal scroll goes right-to-left; shadow indicator flips edges.
- TrustBar marquee: reverses animation direction.
- Number formatting for stats goes through `Intl.NumberFormat` per locale.

### Documentation

User-facing docs for the feature list **are** warranted — the landing page is often the only place users learn what features exist. Add:

- `docs/{en,ar,fr,de,es}/features/overview.md` — one paragraph per feature, mirroring the landing copy but expanded (3–5 sentences each).
- Link from landing `FeaturesSection` "Learn more" text (new `landing.features.learnMore` key → `/docs/features/overview`).

Follow `prompts/04-i18n-full-coverage_done/06-docs-5-language-parity_done.md` pattern for docs structure and translation.

### Verification

- [ ] `make shell-client npm run typecheck` / `lint` clean.
- [ ] `make shell-client npm run test` — 100% coverage on new files.
- [ ] `make shell-client npm run test:e2e -- landing/(features|comparison|trust-bar)` green.
- [ ] Visual regression baselines updated.
- [ ] Manual RTL check — comparison table scroll + sticky column, marquee reversal.
- [ ] Lighthouse: no CLS regression from CountUp (reserve space with `min-width`).
- [ ] `docs/` pages exist in all 5 locales.

### Notes

- Uncodixify: no `rounded-2xl` on feature cards (use `rounded-lg`); no `hover:-translate-y-*`; no `animate-pulse` on trust badges; no gradient on WhyNot comparison column (use `bg-primary/5` solid).
- RTL: no `rtl:flex-row-reverse` on any layout; comparison table pinning must be tested with dir="rtl".
- Docker-only.
