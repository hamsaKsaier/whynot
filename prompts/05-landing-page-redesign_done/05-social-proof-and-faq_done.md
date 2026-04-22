# Landing Page Redesign — Testimonials Carousel & FAQ

## Agent

No agent in `.claude/agents/` yet. Use the skills below.

## Skills

- Primary: `.claude/skills/landing-page-optimization/`, `.claude/skills/social-content/`
- Supporting: `.claude/skills/copywriting/`, `.claude/skills/content-strategy/`, `.claude/skills/shadcn-design-system-compliance/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md` (adapted for URL hash on FAQ), `.claude/rules/spec-driven-development.md`.

## Task

Rebuild `TestimonialsSection` and `FAQSection`. Testimonials get a draggable carousel with autoplay + gesture support; FAQ gets animated accordion + URL-hash deep-linking. Both must be fully accessible, RTL-correct, and reduced-motion-safe. **Depends on `00-foundation.md`**.

### 1. TestimonialsSection (`frontend/src/components/landing/TestimonialsSection.tsx`)

- Three (or more) testimonial cards: headshot, quote, name, title, company.
- **Desktop (`md+`)**: show all three side-by-side in a grid — carousel reduces to a grid on large screens.
- **Mobile / tablet**: horizontal carousel with drag gesture (framer-motion `drag="x"` + `dragConstraints` + `dragElastic={0.15}`).
- **Autoplay**: advances every 6s on mobile. Pauses on:
  - User drag or tap.
  - `hover` / `focus-within` on any card.
  - `document.visibilityState === "hidden"` (tab backgrounded).
  - `prefers-reduced-motion: reduce` — autoplay fully disabled; carousel becomes snap-scroll with native momentum.
- **Indicators**: dots under the carousel show active slide; click to jump; `aria-current="true"` on active.
- **Keyboard navigation**: `ArrowLeft` / `ArrowRight` on focused carousel advances slides; respects RTL (in Arabic, `ArrowLeft` goes to next).
- **Quotes**: wrapped in `<blockquote>` with `<cite>` for the attribution. Semantic HTML.
- **No pulsing/bouncing on any element.**

### 2. FAQSection (`frontend/src/components/landing/FAQSection.tsx`)

- Keep shadcn Radix `Accordion` as base — proven, accessible.
- Add framer-motion height animation on expand/collapse (wrap `AccordionContent` children in a `motion.div` with `height: auto` transition). Reduced motion: instant expand.
- Chevron icon rotates 180° on expand via `transition-transform duration-150` (within Uncodixify limits).
- **Deep-linking**: clicking a question updates the URL hash to `#faq-{id}`. Loading the page with a hash opens that item and scrolls it into view with `scrollIntoView({ behavior: "smooth", block: "center" })` (respecting reduced motion via `"auto"` fallback).
- Only one item open at a time (`type="single"`, `collapsible`).
- Contact link under the FAQ — if user didn't find their question, surface a `mailto:` or link to `/contact`.

### Tests

**Vitest:**
- `TestimonialsSection`:
  - Renders all testimonial cards.
  - Desktop layout: all three visible in grid (mock `window.innerWidth` ≥ 768px).
  - Mobile: one card at a time; drag simulation advances to next.
  - Autoplay advances every 6s (use `vi.useFakeTimers`).
  - Autoplay pauses on `mouseenter` / `focus` / document hidden.
  - Arrow keys navigate; RTL reverses direction.
  - Dot indicator click jumps to slide.
  - Reduced motion: autoplay disabled; carousel still navigable via keyboard + dots.
- `FAQSection`:
  - Renders 5 items.
  - Clicking a question expands; chevron rotates.
  - Second click collapses.
  - Only one open at a time.
  - URL hash updates on expand; hash change from outside opens the matching item.
  - Page load with `#faq-{id}` scrolls to and expands that item.
  - Reduced motion: no height animation.
- 100% coverage on new files.

**Playwright:**
- `e2e/landing/testimonials.spec.ts` — drag gesture via `page.mouse` advances carousel; keyboard arrows work; RTL reverses arrow behavior; autoplay advances after 6s and pauses on hover.
- `e2e/landing/faq.spec.ts` — click Q1 → expand → URL hash updates; navigate to `/#faq-security` → Q about security is open and in view.
- A11y: `@axe-core/playwright` zero critical violations; carousel has `role="region"` + `aria-roledescription="carousel"`; dots have `role="tab"` + `role="tablist"` container.
- Visual regression at standard matrix.

### i18n

Existing keys (verify all 5 locales):

- `landing.testimonials.heading`, `.subheading`, `.items.sarah.*`, `.items.marcus.*`, `.items.elena.*` (quote, name, title, company for each)
- `landing.faq.heading`, `.subheading`, `.items.*` (howItWorks, integration, pricing, security, accuracy — each with `question` + `answer`), `.contactText`, `.contactLink`

New keys likely needed:
- `landing.testimonials.carousel.previous`, `.next`, `.goToSlide` — aria-labels for controls.
- `landing.testimonials.carousel.pausedForReducedMotion` — sr-only announcement.
- `landing.faq.items.*.id` — stable id for URL hash deep-linking (keep in sync across all locales — the ID itself is not translated, stored in a parallel map in component code, not in JSON).
- `landing.faq.deepLinkAriaLabel` — "Copy link to this question".

Any new content (testimonials, FAQ items) added must be translated into all 5 locales. Arabic translation in particular must preserve voice and tone — machine translation alone is not acceptable for testimonials.

**Backend messages**: none — content is static per-locale.

**RTL:**
- Testimonials carousel: drag direction flips in RTL (drag right-to-left reveals the next card in en, left-to-right in ar). The `<Marquee>` primitive doesn't apply here — this is a per-index carousel, so handle the direction flip in the index-advance logic based on `useDirection()`.
- Keyboard: `ArrowLeft` = next in ar, `ArrowRight` = next in en.
- FAQ chevron: vertical, does NOT mirror in RTL.
- Quote mark glyphs: use locale-appropriate quotation marks via CSS `quotes` property or inline in translations (e.g., `«…»` for fr, `„…"` for de, `“…”` for en, `"..."` for ar).

### Documentation

Optional. The FAQ on the landing page is itself user-facing documentation, so a separate `/docs` FAQ is redundant. **Skip `/docs` additions in this prompt** unless the team explicitly wants a long-form FAQ page.

If desired later, add `docs/{en,ar,fr,de,es}/support/faq.md` mirroring the landing FAQ with deeper answers.

### Verification

- [ ] `make shell-client npm run typecheck` / `lint` clean.
- [ ] `make shell-client npm run test` — 100% coverage on new files.
- [ ] `make shell-client npm run test:e2e -- landing/(testimonials|faq)` green.
- [ ] Manual RTL check: carousel drag + arrow keys reversed; FAQ deep-link works in `?lng=ar`.
- [ ] Visual regression baselines updated.
- [ ] A11y: keyboard-only walkthrough of both sections end-to-end.

### Notes

- Uncodixify: no `hover:shadow-lg` on testimonial cards; no `animate-pulse` on dots; no `rounded-2xl`; autoplay speed ≤ 200ms transition between slides (framer-motion spring preset from foundation).
- RTL: no `rtl:flex-row-reverse`. Native `dir="rtl"` plus explicit direction logic in carousel index-advance.
- URL hash deep-linking: borrow the pattern from `.claude/rules/url-tab-state.md` — same idea, but using hash (`#`) instead of search params because FAQ items are anchor targets, not tab state.
- Docker-only.

### Final landing page integration (this is the closing prompt)

After this prompt's components merge, do one final sweep in `frontend/src/pages/landing/LandingPage.tsx`:

- Verify import ordering matches visual flow: Header → Hero → TrustBar → Features → Comparison → Pricing → PaygPricing → Testimonials → FAQ → CTA → StickyBottomCTA → Footer.
- Confirm every section wrapped by `<Reveal>` or `<Stagger>` as appropriate.
- Run the full Playwright suite: `make shell-client npm run test:e2e -- landing/` — every spec from prompts 00–05 green.
- Regenerate visual regression baselines if needed.
- Confirm `/` renders cleanly in all 5 locales via `make shell-client npm run test -- pages-i18n`.
- Remove any orphaned v1 components or hooks no longer referenced.
