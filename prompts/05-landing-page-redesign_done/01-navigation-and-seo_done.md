# Landing Page Redesign — Navigation, Footer & SEO

## Agent

No agent in `.claude/agents/` yet. Use the skills below. Recommend promoting a `frontend-navigator` agent if this theme continues.

## Skills

- Primary: `.claude/skills/landing-page-optimization/`
- Supporting: `.claude/skills/shadcn-design-system-compliance/`, `.claude/skills/brand-guidelines/`, `.claude/skills/programmatic-seo/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/spec-driven-development.md`.

## Task

Rebuild the landing page's navigation chrome — `Header`, `Footer`, `SEOHead`, `StructuredData` — to a level matching Linear, Vercel, and Stripe. The current implementation is functional but static; we need scroll-aware chrome, an animated mobile sheet, per-locale SEO with proper `hreflang`, tightened JSON-LD, and a footer that breathes. **Depends on `00-foundation.md`** being merged — this prompt imports from `@/components/motion/*`.

### 1. Header (`frontend/src/components/landing/Header.tsx`)

- Sticky position with scroll-reactive backdrop: transparent over hero, `bg-background/90` + `border-b` + modest `shadow-sm` once past 64px scroll. Use framer-motion `useScroll` + `useTransform` on `backdropFilter` is **forbidden** (no glassmorphism per Uncodixify). Instead, interpolate `backgroundColor` opacity from 0 to `--background`.
- Height shrinks from `h-20` to `h-16` past threshold. Animate via `transition-colors` + `height` only (no `transition-all`, max `duration-200`).
- Desktop nav links (`Features`, `Pricing`, `Docs`, `Sign in`, `Get started`) highlight the active section as the user scrolls — track sections via `IntersectionObserver` and apply `data-active="true"` styling.
- Mobile sheet opens from the start edge (LTR: left, RTL: right — the existing shadcn `Sheet` handles this). Replace instant open with framer-motion `AnimatePresence` stagger of menu items (reuse `<Stagger>` from foundation).
- Language switcher + theme toggle: compact in mobile sheet, inline on desktop.
- Logo: keep brand mark; add subtle `FadeIn` on first mount (only at `prefers-reduced-motion: no-preference`).

### 2. Footer (`frontend/src/components/landing/Footer.tsx`)

- Four-column grid on `lg+`, 2-column on `sm+`, stacked on mobile.
- `<Stagger>` reveals columns as the footer enters viewport.
- Language switcher as a segmented control with flag emoji + locale code; shows the current language with `aria-current`.
- Legal row: © year, Terms, Privacy, Security. `<small>` semantic element.
- GitHub / X icons with `aria-label` — no external target without `rel="noopener noreferrer"`.
- RTL: logo stays on start edge, legal row flips naturally via `dir="rtl"`; verify no `rtl:flex-row-reverse` sneaks in.

### 3. SEOHead (`frontend/src/components/landing/SEOHead.tsx`)

- Render via `react-helmet-async` (check it's already a dep; if not, prefer native `<head>` manipulation — verify via Context7).
- Per-locale `<title>`, `<meta name="description">`, `<meta name="keywords">` pulled from `landing.seo.*` keys.
- `<link rel="canonical">` to the locale-less canonical URL (`https://whynot.app/`).
- `<link rel="alternate" hreflang="{lng}" href="https://whynot.app/?lng={lng}">` for all 5 locales + `x-default`.
- Open Graph: `og:title`, `og:description`, `og:image` (`https://whynot.app/og/{lng}.png`), `og:locale`, `og:locale:alternate` for the other four.
- Twitter Card: `summary_large_image`, handle `@whynotqa` (confirm with brand-guidelines skill).

### 4. StructuredData (`frontend/src/components/landing/StructuredData.tsx`)

Emit JSON-LD via `<script type="application/ld+json">`. Validate shapes via schema.org docs (web search / Context7) at generation time — don't trust training knowledge alone. Emit:

- **Organization**: `name`, `url`, `logo`, `sameAs` (GitHub, X).
- **WebSite** with `potentialAction: SearchAction` if search exists on landing; omit if not.
- **Product** (SaaS): `name`, `description`, `offers` pulled from pricing defaults.
- **FAQPage**: `mainEntity` = array of `Question`/`Answer` pairs matching `landing.faq.items.*` — translated per locale.
- **BreadcrumbList** omitted on root since it's a single-level page.

All JSON-LD must be per-locale so the `name` / `description` strings match the page language.

### Tests

**Vitest:**
- `Header`: renders all desktop nav items; mobile sheet opens on button click; scroll event past 64px toggles `data-scrolled="true"`; active-section marker follows `IntersectionObserver` mock; language switch changes `i18n.language` and persists to `localStorage`; theme toggle cycles `light → dark → system`.
- `Footer`: renders 4 columns; all links present; `aria-current` on active locale; `rel="noopener noreferrer"` on every external link.
- `SEOHead`: for each of en/ar/fr/de/es — title/description/keywords match the locale JSON; `hreflang` entries cover all 5 + `x-default`.
- `StructuredData`: parses to valid JSON; `FAQPage.mainEntity` length matches `landing.faq.items` count; `Organization.name` translated per locale.
- Reduced-motion: sheet opens instantly, stagger omitted.
- Coverage: 100% on all 4 files.

**Playwright:**
- `e2e/landing/header.spec.ts` — desktop nav click scrolls to anchor; mobile sheet open → link click → navigates + closes; language switch round-trip; theme toggle persists across reload.
- `e2e/landing/footer.spec.ts` — every link is focusable via keyboard; `Tab` order follows DOM; `Shift+Tab` reverses cleanly.
- `e2e/landing/seo.spec.ts` — fetch `/` for each locale, assert `<title>`, `<meta description>`, canonical, `hreflang` all present and correct.
- `e2e/landing/structured-data.spec.ts` — extract every `script[type="application/ld+json"]`, `JSON.parse` each, assert required keys present.
- RTL visual snapshot for Arabic — added to the baseline from prompt 00.

### i18n

Keys used from existing `landing.json` (add any missing):

- `landing.nav.features`, `landing.nav.pricing`, `landing.nav.docs`, `landing.nav.signIn`, `landing.nav.getStarted`, `landing.nav.openApp`, `landing.nav.menu`, `landing.nav.changeLanguage`, `landing.nav.main`
- `landing.footer.description`, `.product`, `.features`, `.pricing`, `.changelog`, `.company`, `.about`, `.blog`, `.contact`, `.resources`, `.docs`, `.status`, `.api`, `.legal`, `.privacy`, `.terms`, `.copyright`, `.github`, `.twitter`
- `landing.seo.title`, `landing.seo.description`, `landing.seo.keywords`
- New: `landing.nav.themeToggleLabel`, `landing.footer.securityLink`, `landing.footer.allRightsReserved`

Process for each new key:
1. Add to `frontend/public/locales/en/landing.json` with copy reviewed via `copywriting` skill.
2. Add translations to `ar`, `fr`, `de`, `es` with human-quality translations (run LLM + review). Arabic must read naturally — not machine-literal.
3. Update `frontend/src/__tests__/pages-i18n.test.tsx` manifest if `/` isn't already covered at 100%.
4. Run `make shell-client npm run test -- i18n` to confirm.

RTL:
- Arabic nav items must not overflow on 360px width — test at `360x740`.
- Language-switcher flag emoji render correctly in Arabic font stack.

Backend-triggered messages: none in this prompt (navigation is presentational).

### Documentation

Not applicable — navigation chrome is implicit UX, not a user concept requiring `/docs` pages.

### Verification

- [ ] `make shell-client npm run typecheck` / `lint` clean.
- [ ] `make shell-client npm run test` — 100% coverage on new/changed files.
- [ ] `make shell-client npm run test:e2e -- landing/(header|footer|seo|structured-data)` green.
- [ ] Manual RTL spot-check at `?lng=ar` — mobile sheet opens from the correct edge; no double-mirroring.
- [ ] Lighthouse SEO score ≥ 95 on `/` (run via Playwright's built-in Lighthouse or manual).

### Notes

- Uncodixify: no `backdrop-blur`, no gradient text, no `rounded-full` on the language switcher (use `rounded-md`), no `hover:shadow-md` on footer cards.
- RTL: no `rtl:flex-row-reverse`. Confirm by grep: `grep -r "rtl:flex-row-reverse" frontend/src/components/landing/` must return empty.
- Docker-only: every command via `make shell-client`.
