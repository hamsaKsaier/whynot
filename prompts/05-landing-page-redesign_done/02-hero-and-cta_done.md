# Landing Page Redesign — Hero, CTA Bands & Email Capture

## Agent

No agent in `.claude/agents/` yet. Drive this via the skills below. If CRO work deepens, a dedicated `conversion-optimizer` agent could be promoted.

## Skills

- Primary: `.claude/skills/landing-page-optimization/`, `.claude/skills/page-cro/`
- Supporting: `.claude/skills/copywriting/`, `.claude/skills/popup-cro/`, `.claude/skills/signup-flow-cro/`, `.claude/skills/shadcn-design-system-compliance/`, `.claude/skills/ab-test-setup/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/spec-driven-development.md`.

## Task

Rebuild the primary conversion surface: `HeroSection`, `CTASection`, `StickyBottomCTA`, `EmailCapture`. These components convert visitors — they must feel handcrafted, load instantly, animate gracefully, and degrade to static under `prefers-reduced-motion`. **Depends on `00-foundation.md`**.

### 1. HeroSection (`frontend/src/components/landing/HeroSection.tsx`)

- **Layout**: two-column on `lg+` (copy start, media end); single-column stacked on `md-`. Copy side: eyebrow chip, headline, sub-headline, dual CTA row, no-credit-card line, tiny social-proof line with avatars.
- **Headline animation**: word-by-word `FadeIn` + 4px `SlideIn` from bottom, using `<Stagger stagger={60}>` from foundation. Headline text comes from `landing.hero.title` — split on spaces at render time (NOT at translation time — Arabic word segmentation differs).
- **Media**: product screenshot or short muted looping `<video>` (max 2 MB, `preload="metadata"`). Wrap in `<Parallax speed={0.15}>`. Add a subtle border-glow via `ring-1 ring-border` (NOT a colored glow — Uncodixify forbids decorative shadows).
- **CTAs**: primary `Get started` (solid) + secondary `View pricing` (outline). Both use `rounded-md`. Icon on primary is an arrow with `rtl:scale-x-[-1]`. Hover: `transition-colors duration-150` only — **no translate, no scale, no shadow escalation**.
- **No-credit-card line** + **social proof**: sits under CTAs; fades in 400ms after CTAs.
- **Authenticated-user state**: if `useAuth().user` is present, hero CTA becomes `Open app` pointing to `/dashboard`. Preserve existing behavior from v1 `HeroSection.tsx`.

### 2. CTASection (`frontend/src/components/landing/CTASection.tsx`)

- Full-bleed band near the end of the page. Solid `bg-muted` or `bg-card` (NO gradient, NO glass).
- Large headline + single `Get started` CTA + three trust signals (free tier, no card, 30-day guarantee) as icon + label row.
- Reveal via `<Reveal>` on scroll-in.
- Keep it brief — this is the "last-chance" conversion, not a feature repeat.

### 3. StickyBottomCTA (`frontend/src/components/landing/StickyBottomCTA.tsx`)

- Fixed bottom bar, visible only on `< lg` screens.
- Slides in via framer-motion `AnimatePresence` once the user has scrolled past the hero (use `useInView` on a sentinel element at the bottom of the hero).
- Dismiss button persists via `localStorage` key `landing.stickyCTA.dismissed` (scoped by date — re-show after 30 days so returning visitors see it again).
- Two-element layout: short copy + CTA button. Both inline, no wrapping on 360px.
- RTL: dismiss button sits on the end edge (use `end-2`).
- Accessibility: `role="region"` with `aria-label` from `landing.stickyBottomCTA.ariaLabel`. Focus order: CTA first, dismiss second.
- Reduced motion: appears with opacity only, no slide.

### 4. EmailCapture (`frontend/src/components/landing/EmailCapture.tsx`)

- Single-input form. Inline validation on blur (email regex + MX-shape check); submit button disabled until valid.
- States: `idle`, `submitting`, `success`, `error`, `rate-limited`.
- Motion transitions between states via `AnimatePresence` with `mode="wait"`. Height animates smoothly — use framer-motion `layout` prop.
- Rate limiting: after 3 rapid submissions within 60s, show `landing.emailCapture.rateLimited` and lock for 60s countdown.
- Error state: server errors surface localized message from the gateway (not hardcoded English).
- Accessibility: `aria-live="polite"` region for state messages; `aria-invalid` on the input when validation fails.
- RTL: placeholder text alignment follows `dir`; arrow icon on submit mirrors.

### Tests

**Vitest:**
- `HeroSection`: renders headline word-stagger; unauth → `Get started` CTA; auth → `Open app` CTA; video element has `preload="metadata"`; reduced-motion renders without `motion.*` wrappers (assert via `data-motion` absence when `matchMedia` returns reduced).
- `CTASection`: renders 3 trust signals; CTA link points to `/signup`.
- `StickyBottomCTA`: hidden on `lg+` (use `matchMedia` mock); slide-in triggered by sentinel `useInView`; dismiss sets `localStorage` and hides; re-renders after 30 days (mock `Date.now`).
- `EmailCapture`: each state renders once; invalid email disables submit; successful submit transitions to success state; 4th rapid submit triggers rate-limit; error from API surfaces the localized message verbatim.
- Reduced-motion paths for all four components.
- 100% coverage on new files.

**Playwright:**
- `e2e/landing/hero.spec.ts` — headline fully visible after animation window; CTAs clickable; authenticated session shows `Open app`.
- `e2e/landing/email-capture.spec.ts` — invalid → error; valid → success; rapid submits → rate-limited.
- `e2e/landing/sticky-cta.spec.ts` — scroll past hero → bar appears; dismiss → hidden on reload within 30 days; appears again after simulated 31-day skip.
- Visual regression at 360/768/1024/1440 × light/dark × en/ar.
- A11y: `@axe-core/playwright` zero critical violations in every locale.

### i18n

Existing keys used (verify they exist in all 5 locales, add missing translations):

- `landing.hero.title`, `.subtitle`, `.cta`, `.secondaryCta`, `.socialProof`, `.noCreditCard`
- `landing.cta.heading`, `.subheading`, `.getStarted`, `.trustSignals.freeTier`, `.trustSignals.noCreditCard`, `.trustSignals.moneyBack`
- `landing.stickyBottomCTA.ariaLabel`, `.text`, `.cta`, `.dismiss`
- `landing.emailCapture.placeholder`, `.ariaLabel`, `.cta`, `.sending`, `.success`, `.error`, `.invalidEmail`, `.rateLimited`

New keys if needed:
- `landing.hero.eyebrow` — small chip above headline.
- `landing.hero.videoCaption` — sr-only caption describing the demo video.
- `landing.emailCapture.rateLimitedCountdown` — "Try again in {{seconds}}s".

For every new key: add to `en/landing.json` first, then generate quality translations for `ar/fr/de/es` and have them reviewed by the `copywriting` skill (ideally human-reviewed for ar). Update Vitest i18n snapshot tests.

**Backend-triggered messages**: `EmailCapture` hits an API (existing endpoint or new — confirm during implementation). Any error response text from the gateway must come from `gateway/src/i18n/translations/{lng}/` — not hardcoded. If a new gateway endpoint is introduced, follow `.claude/skills/backend-i18n/` patterns: translate success + error messages for all 5 locales.

**RTL:**
- Hero headline word-stagger: verify direction on `ar` — words should appear right-to-left following the text flow, not left-to-right. The `<Stagger>` primitive from foundation handles this if we iterate the rendered word array in DOM order.
- Arrow icons: `rtl:scale-x-[-1]` applied.
- Email input `placeholder` alignment: inherits `dir="rtl"`.
- Do NOT use `rtl:flex-row-reverse` on the CTA row — native flex handles it.

### Documentation

Worth adding user-facing docs for **email capture** and **hero CTAs** only if product behavior differs from trivial expectation. Default: **skip**. If the team decides to document the free-tier onboarding triggered from hero, add `docs/{en,ar,fr,de,es}/getting-started/landing-cta.md` with a single-paragraph orientation. Otherwise leave this prompt with no docs.

### Verification

- [ ] `make shell-client npm run typecheck` / `lint` clean.
- [ ] `make shell-client npm run test` — 100% coverage on new files.
- [ ] `make shell-client npm run test:e2e -- landing/(hero|email-capture|sticky-cta)` green.
- [ ] Visual regression baselines updated for hero + CTA bands.
- [ ] Lighthouse: LCP < 2.5s on 4G Slow (the hero must not regress this).
- [ ] Manual RTL + dark-mode walkthrough.

### Notes

- Uncodixify: no `hover:-translate-y-*`, no `hover:scale-*`, no gradient text on headline, no glassmorphism on video frame, no `animate-pulse` on dismiss button.
- RTL: no `rtl:flex-row-reverse`. Icons that should mirror: `ArrowRight` on primary CTA, arrow on `EmailCapture` submit.
- Docker-only.
- Respect project conventions: ISO 8601 dates, camelCase JSON, mobile-first breakpoints, bigint cents for money (not relevant here but confirm PricingSection stays conformant in prompt 04).
