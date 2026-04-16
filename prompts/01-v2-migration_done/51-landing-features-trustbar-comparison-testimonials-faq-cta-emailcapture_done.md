# Landing page: Features, TrustBar, Comparison, Testimonials, FAQ, CTA, EmailCapture

## Agent
`design-ui-designer` (lead) + `translation-manager` + skill `shadcn-design-system-compliance`

## Depends on
`50-validate-landing-shell-hero.md`

## Goal
Port the remaining landing-page section components from the reference repo, wire them into LandingPage, externalize all copy to `landing.json` in 5 languages, and add a working email-capture feature persisting to a new `landing_leads` table.

## Single source of truth
`ARCHITECTURE.md` section 7.

## Reference
`/home/serverlessbase/serverless-v2/client/src/components/landing/`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (new migration requires user coordination)

## Task

### 1. Coordinate migration
- After user approval, create `services/database/migrations/0NN_landing_leads.sql`:
  ```sql
  CREATE TABLE landing_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    source text,
    locale text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_landing_leads_email ON landing_leads(lower(email));
  ```

### 2. Section components
- `frontend/src/components/landing/FeaturesSection.tsx` — feature grid w/ icons + copy
- `frontend/src/components/landing/TrustBar.tsx` — logo strip
- `frontend/src/components/landing/ComparisonSection.tsx` — vs-competitor table
- `frontend/src/components/landing/TestimonialsSection.tsx` — carousel
- `frontend/src/components/landing/FAQSection.tsx` — accordion
- `frontend/src/components/landing/CTASection.tsx` — final CTA
- `frontend/src/components/landing/StickyBottomCTA.tsx` — sticky CTA on scroll
- `frontend/src/components/landing/EmailCapture.tsx` — form posting to `/api/landing/leads`

### 3. Backend endpoint
- `gateway/src/api/landing/leads.ts`:
  - `POST /api/landing/leads` body `{ email, source?, metadata? }`
  - Validates email, deduplicates by lower(email), captures locale from `Accept-Language`.
  - Rate-limited (per IP) to prevent abuse.
  - Optionally gated by `LANDING_LEAD_CAPTURE` feature flag from phase 5.

### 4. i18n content
- `frontend/public/locales/{en,ar,fr,de,es}/landing.json` filled with **real translations** for every section. (This prompt does the content work — feeds into prompt 52's validation.)

### 5. Compose into LandingPage
- Update `frontend/src/pages/landing/LandingPage.tsx` to render the full section sequence.

### Files to create/modify
- `services/database/migrations/0NN_landing_leads.sql` — new (user-coordinated)
- `gateway/src/api/landing/leads.ts` — new
- `frontend/src/components/landing/{FeaturesSection,TrustBar,ComparisonSection,TestimonialsSection,FAQSection,CTASection,StickyBottomCTA,EmailCapture}.tsx` — new
- `frontend/src/pages/landing/LandingPage.tsx` — extended
- `frontend/public/locales/{en,ar,fr,de,es}/landing.json` — real content

### Tests
- Component tests for each section (snapshot + interaction).
- Supertest for `POST /api/landing/leads`: valid → 200 + row inserted; duplicate → 200 (idempotent); invalid email → 400; rate-limit exceeded → 429; flag disabled → 403.
- Playwright e2e: scroll through landing page, submit email capture, assert success toast and DB row.
- Axe scan on full landing page.

### i18n
- Every visible string localized in 5 languages.

### Documentation
- `docs/{en,ar,fr,de,es}/landing/sections.md`

### Acceptance criteria
- [ ] All 8 sections rendered + composed.
- [ ] Email capture writes to `landing_leads`, deduplicated, rate-limited.
- [ ] Real translations for all 5 languages.
- [ ] Axe + Lighthouse a11y pass.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
