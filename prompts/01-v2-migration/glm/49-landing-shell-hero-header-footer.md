# Landing page: shell, header, hero, footer

## Agent
`design-ui-designer` (lead) + `design-ux-architect` (consult) + skill `shadcn-design-system-compliance`

## Depends on
`48-validate-superadmin-audit-analytics-usage.md`

## Goal
Stand up the landing-page tree under `frontend/src/pages/landing/`, port the Header, HeroSection, and Footer components from the reference repo (Shadcn-styled), and adapt copy to whynot's value proposition.

## Single source of truth
`ARCHITECTURE.md` section 7.

## Reference
`/home/serverlessbase/serverless-v2/client/src/components/landing/`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Routing
- `frontend/src/router.tsx`: add `/` route serving `LandingPage`. The previous "/" (post-login dashboard) moves to `/app` (or whatever the existing pattern is — check first and preserve auth gating).
- Public visitors land on `/`; authenticated users on `/` see a CTA to "Open app" linked to `/app`.

### 2. Components
- `frontend/src/pages/landing/LandingPage.tsx` — composes sections (only Header + Hero + Footer in this prompt; remaining sections in prompt 51).
- `frontend/src/components/landing/Header.tsx` — sticky, transparent → solid on scroll, language switcher, "Sign in" + "Get started" CTAs, mobile drawer.
- `frontend/src/components/landing/HeroSection.tsx` — headline, subheadline, primary + secondary CTAs, hero illustration/video placeholder, social proof line.
- `frontend/src/components/landing/Footer.tsx` — link columns, social, language switcher, copyright.

### 3. Copy
- All visible text via `t('landing:*')` keys. English copy adapted to whynot (the QA agents product). Other languages get placeholders to be replaced in prompt 51's i18n step.

### 4. Styles
- Mobile-first, dark mode, RTL via logical properties. No hardcoded colors.

### Files to create/modify
- `frontend/src/pages/landing/LandingPage.tsx`
- `frontend/src/components/landing/{Header,HeroSection,Footer}.tsx`
- `frontend/src/router.tsx` — landing route + `/app` move
- `frontend/public/locales/en/landing.json` — populated keys (other locales clone-with-en for now; prompt 51 covers the full content sweep)
- `frontend/public/locales/{ar,fr,de,es}/landing.json` — placeholder structure

### Tests
- Vitest component tests for Header, Hero, Footer.
- Playwright: `/` renders, header sticky on scroll, mobile drawer opens, CTAs navigate to `/login` and `/signup`.
- Visual: light + dark + RTL for /  desktop + mobile.
- Axe scan on `/`.

### i18n
- `landing` namespace exists in all 5 locales (en filled, others structural).

### Documentation
- `docs/{en,ar,fr,de,es}/landing/overview.md`

### Acceptance criteria
- [ ] `/` renders LandingPage with Header + Hero + Footer.
- [ ] Authenticated users see "Open app" CTA.
- [ ] Mobile + dark + RTL clean.
- [ ] Axe a11y passes.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
