# 15 — Responsive: Landing Pages (Hero, Features, Pricing, FAQ, CTA)

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/agents/design/design-visual-storyteller.md`
- `.claude/skills/landing-page-optimization/`
- `.claude/rules/uncodixify-ui.md`
- STYLES.md

## Task

Landing pages are the first impression. They must feel premium on every device and under every language. Today they rely on gradients, glassmorphism, and fixed-width layouts that break below 768px.

**Routes in scope**:
- `frontend/src/pages/LandingPage.tsx` (root marketing page)
- Landing sections: `Hero`, `TrustBar`, `Features`, `Comparison`, `Testimonials`, `FAQ`, `CTA`, `EmailCapture`, `Pricing`, `PAYG`, `SEOMeta`
- Landing footer and header
- Any alternate marketing routes (e.g., `/features/ai-testing`, `/compare/playwright`)

### Scope / Requirements

1. **Hero**
   - Headline: `text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-semibold`.
   - Subheadline: `text-base sm:text-lg`.
   - CTA buttons: stacked on mobile, inline on `sm+`.
   - Hero visual: video or illustration, constrained to `max-w-full aspect-video`, lazy-loaded.
   - **No gradients, no glassmorphism, no `text-white` on gradient** (per prompt 07).

2. **TrustBar (logos)**
   - `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4` for customer logos.
   - Logos monochrome (desaturate to match `text-muted-foreground`) for consistency.

3. **Features**
   - Three- or four-column grid on desktop, single column on mobile.
   - Each feature: icon + title + description, uniform height.
   - Icons match STYLES.md sizing.

4. **Comparison**
   - Comparison table: responsive (stack into cards on mobile).
   - Highlight whynot column with `border-primary`.

5. **Testimonials**
   - Carousel on mobile (swipeable), grid on desktop.
   - Customer photo (circle), name, role, quote.

6. **Pricing**
   - Mirror prompt 14's pricing card layout but with marketing-oriented copy.
   - Link "Subscribe" to Stripe Checkout (after login if not authenticated).

7. **PAYG**
   - Usage-based pricing explanation with interactive calculator.

8. **FAQ**
   - Accordion pattern (`shadcn Accordion`).
   - Each question is a heading; answer collapses below.
   - All expanded by default on desktop? — no, collapsed; users choose.

9. **CTA**
   - Final "Start free trial" section, full-width button on mobile.

10. **EmailCapture**
    - Newsletter form: full-width input + button, inline on `sm+`.
    - Success toast localized.

11. **Header**
    - Sticky top nav with `bg-background/95` (no backdrop-blur — replace any glassmorphism).
    - Hamburger menu on mobile (shadcn `Sheet`).
    - Language switcher + theme toggle + "Sign in" / "Sign up" buttons.

12. **Footer**
    - 4-column layout on desktop (Product / Company / Resources / Legal).
    - Stacks to single column on mobile.
    - Language switcher duplicate.
    - Social icons.

13. **SEO meta**
    - `<meta>` tags in 5 languages (one per route + hreflang).
    - Open Graph images per language.

14. **Lighthouse**
    - Mobile Lighthouse score ≥90 for Performance, Accessibility, Best Practices, SEO.
    - Images lazy-loaded, optimal formats (WebP / AVIF via `<picture>`).

15. **Touch targets, dark mode, RTL, logical properties, uncodixify compliance**.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots** at 7 viewports for every section.
- **Lighthouse CI**: mobile + desktop, ≥90 in every category.
- **Accordion interaction**: FAQ opens/closes; only one open at a time (configurable).
- **Carousel swipe**: mobile gesture advances testimonial.
- **Newsletter submit**: valid email succeeds, invalid fails with inline error.
- **Language-specific hreflang**: assert `<link rel="alternate" hreflang="...">` present for all 5 languages.
- **RTL**: all sections render mirrored in Arabic.
- **i18n**: all 5 languages, German overflow check especially in headlines.

### i18n (5 languages)
- Keys under `landing.*` from prompt 01.
- Each section's copy translated per prompt 02-05.
- Meta tags localized (title, description, keywords).
- URLs can remain English; `hreflang` attribute handles language mapping.

### Documentation
- Marketing docs belong on the marketing site, not `/docs`. Skip `/docs` updates for this prompt unless adding a "How to self-host" page.

### Constraints
- Docker-only.
- Lighthouse mobile ≥90 — if it's not, the prompt is not done.
- Image assets optimized (`sharp` or `squoosh` in CI).
- Uncodixify compliance.
- No gradients, no glassmorphism.

### Verification steps
1. `make shell-client npm run typecheck && npm run lint && npm test`
2. `make shell-client npm run test:responsive -- landing`
3. `make shell-client npm run lighthouse -- mobile` → ≥90 everywhere.
4. `make start` → visit landing at 320px, 768px, 1920px in all 5 languages and both themes.
