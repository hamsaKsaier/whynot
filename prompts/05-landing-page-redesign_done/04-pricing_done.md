# Landing Page Redesign — Pricing Tiers & PAYG Calculator

## Agent

No agent in `.claude/agents/` yet. Use the skills below.

## Skills

- Primary: `.claude/skills/pricing-strategy/`, `.claude/skills/landing-page-optimization/`
- Supporting: `.claude/skills/page-cro/`, `.claude/skills/paywall-upgrade-cro/`, `.claude/skills/copywriting/`, `.claude/skills/shadcn-design-system-compliance/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/switch-component-styling.md`, `.claude/rules/spec-driven-development.md`.

## Task

Rebuild `PricingSection` and `PaygPricingSection`. Pricing is where landing pages make or break — it must be scannable, trustworthy, and honest. We'll add a monthly/annual toggle with layout animation, live-updating PAYG calculator, and expandable worked example. **Depends on `00-foundation.md`**.

### 1. PricingSection (`frontend/src/components/landing/PricingSection.tsx`)

- Three tiers: **Free**, **Pro BYO** (bring-your-own LLM key), **Pro Managed** (hosted LLMs with credits).
- Layout: 3 cards on `lg+`, 1 stacked on `md-`.
- Pro BYO (or the designated "popular" tier) carries an animated "Popular" badge — `Badge` with solid color, entry `FadeIn`, no pulsing/bouncing.
- Monthly ↔ Annual toggle at the top — shadcn `Tabs` or `ToggleGroup`. Annual pricing shows monthly-equivalent + "Save {x}%" chip. Toggle animates the price via framer-motion `layout` + `AnimatePresence` so the number transitions smoothly, not a hard swap.
- Card hover: `ring-1 ring-primary/50` + `border-primary/30` — NO lift, NO shadow escalation, NO scale (Uncodixify).
- "Popular" card: default `ring-1 ring-primary` + modest visual weight via typography, not via shadow or gradient.
- CTAs per card: `Start free`, `Get started`, `Contact sales` — each links to correct destination.
- Fetches live pricing from the existing API; falls back to hardcoded defaults if request fails. Preserve the existing fallback logic from v1 `PricingSection.tsx`.
- **Money handling**: all monetary values originate as `bigint` cents from the gateway (per project convention). Format via `Intl.NumberFormat(lang, { style: "currency", currency: "USD" })` after converting to major units. Never floor/round on the client beyond `Intl`'s own formatting.
- RTL: prices display with currency symbol in natural Arabic position (e.g., `٩٫٩٩ $` — let `Intl` decide).

### 2. PaygPricingSection (`frontend/src/components/landing/PaygPricingSection.tsx`)

- **Credit breakdown table**: rows for test generation, test execution, QA loop iteration, auto-fix attempt, visual regression, QA monitor session, CI scan. Each row: event name + credit cost.
- **Credit pack pricing**: cards showing pack sizes (e.g., 1k / 10k / 100k credits) with per-credit rate. Cheaper packs = "best value" chip.
- **Live calculator**: inputs for projected monthly usage of each event. Output: estimated credits per month + recommended pack. Uses `<CountUp>` from foundation when totals change — animated transitions, not jarring swaps.
- **Worked example**: collapsible card with a concrete scenario (e.g., "SaaS team with 20 engineers ships 3× weekly: X tests × Y iterations = Z credits ≈ $A/mo"). Expand/collapse with framer-motion `layout` height animation + chevron rotation.
- All calculator math runs client-side with clear, testable functions in `frontend/src/lib/pricing/payg-calculator.ts` — pull out of the component for unit testing.
- Input validation: non-negative integers; cap at a sane upper bound to prevent UI hangs on absurd inputs.

### Tests

**Vitest:**
- `PricingSection`:
  - Renders 3 tier cards.
  - API success: shows live prices.
  - API failure: falls back to defaults without error UI.
  - Monthly/annual toggle: switching updates displayed price; "Save x%" chip shows on annual.
  - `Intl.NumberFormat` renders the expected string per locale (en: `$9.99`, ar: `٩٫٩٩ $`, de: `9,99 $`, etc.).
  - Popular badge present on the designated tier.
  - No forbidden Uncodixify classes on cards (assert via className inspection).
- `PricingCard` (if extracted): props → rendered output snapshot.
- `PaygPricingSection`:
  - Credit breakdown renders all 7 event rows.
  - Calculator inputs update total; total animates via `<CountUp>`.
  - Recommended pack switches based on calculated total.
  - Worked example expand/collapse toggles `aria-expanded` correctly.
- `payg-calculator.ts`: unit tests for total computation, pack recommendation thresholds, upper-bound clamping, negative input rejection.
- Reduced-motion: calculator `CountUp` shows final value instantly; worked example expand has no height animation.
- 100% coverage on all new files.

**Playwright:**
- `e2e/landing/pricing.spec.ts` — monthly/annual toggle round-trip; CTA links navigate to correct signup with plan query param.
- `e2e/landing/payg.spec.ts` — change calculator input → total updates → recommended pack updates; expand worked example → content visible; RTL calculator input direction correct.
- Visual regression at standard matrix (mobile/tablet/desktop × light/dark × en/ar) — critical because pricing cards visually carry the brand.
- A11y: all inputs have `<label>`; toggle group has `role="tablist"` semantics where applicable; zero critical violations.

### i18n

Existing keys (verify all 5 locales):

- `landing.pricing.heading`, `.subheading`, `.monthly`, `.free`, `.popular`, `.startFree`, `.getStarted`, `.trialDays`
- `landing.pricing.plans.free.*`, `.pro_byo.*`, `.pro_managed.*` (each with `name`, `description`, `features` array, `cta`)
- `landing.payg.heading`, `.subheading`, `.event`, `.credits`, `.example`, `.events.*` (7 event labels), `.creditsUnit`, `.creditPack`, `.calculator.*`, `.workedExample.*`

New keys likely needed:
- `landing.pricing.annual` — "Annual" toggle label.
- `landing.pricing.saveBadge` — e.g. "Save {{percent}}%".
- `landing.pricing.perMonth`, `landing.pricing.perYear`, `landing.pricing.monthlyEquivalent`
- `landing.payg.calculator.inputLabel.*` — one per event.
- `landing.payg.calculator.totalCreditsLabel`, `.estimatedMonthlyCost`, `.recommendedPack`
- `landing.payg.workedExample.expand`, `.collapse`

Translation process per new key: en first, human-quality ar/fr/de/es translations. Verify via `frontend/src/__tests__/pages-i18n.test.tsx` that `/` renders cleanly in all 5 locales.

**Backend-triggered messages**: the pricing API endpoint returns tier data. If error responses need user-facing copy (e.g., "Failed to load latest pricing — showing defaults"), localize the copy on the client using `landing.pricing.errorFallback` — do NOT display raw server errors.

**RTL:**
- Price formatting via `Intl.NumberFormat` handles currency position.
- Toggle group (`Tabs`) respects RTL natively via shadcn.
- Calculator input alignment inherits `dir`.
- Chevron icon on worked example: mirror with `rtl:scale-x-[-1]` when pointing start/end (vertical chevrons don't mirror).

### Documentation

**Required.** Pricing is a first-class user concept. Create:

- `docs/{en,ar,fr,de,es}/pricing/plans.md` — detailed breakdown of Free / Pro BYO / Pro Managed with use-case guidance.
- `docs/{en,ar,fr,de,es}/pricing/payg.md` — how credits work, event-by-event cost table, FAQ on overages.
- `docs/{en,ar,fr,de,es}/pricing/calculator.md` — how to use the calculator, example scenarios.

Each file in all 5 languages. Follow `prompts/04-i18n-full-coverage_done/06-docs-5-language-parity_done.md` for structure and tooling.

Link from:
- `landing.pricing.plans.*.learnMore` → `/docs/pricing/plans`.
- `landing.payg.calculator.learnMore` → `/docs/pricing/calculator`.

### Verification

- [ ] `make shell-client npm run typecheck` / `lint` clean.
- [ ] `make shell-client npm run test` — 100% coverage on pricing files incl. `payg-calculator.ts`.
- [ ] `make shell-client npm run test:e2e -- landing/(pricing|payg)` green.
- [ ] All docs pages exist and render in all 5 locales.
- [ ] Manual check: toggle monthly→annual animates smoothly; calculator inputs respond without jank; worked example expand height-animates.
- [ ] Verify with RTL (`?lng=ar`): currency formatting, toggle direction, chevron mirror.
- [ ] Lighthouse: no CLS regression from layout-animated price.

### Notes

- **Switch component rule**: this prompt may use shadcn `Switch` for the monthly/annual toggle (though `ToggleGroup` is preferred). If using `Switch`, never apply `min-h-[44px]` or `min-w-[44px]` directly — touch target via parent container (per `.claude/rules/switch-component-styling.md`).
- **Money convention**: bigint cents end-to-end. Client receives cents, formats via `Intl`.
- Uncodixify: no `hover:-translate-y-*`, no `hover:shadow-lg`, no `rounded-2xl` on cards, no gradient backgrounds. Popular badge is a solid `Badge`, not a decorative element.
- RTL: no `rtl:flex-row-reverse`.
- Docker-only.
