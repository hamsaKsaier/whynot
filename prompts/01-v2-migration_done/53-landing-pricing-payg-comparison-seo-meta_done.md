# Landing page: Pricing, PAYG comparison, SEO, structured data, sitemap

## Agent
`design-ui-designer` (lead) + `api-designer`

## Depends on
`52-validate-landing-sections-full-page.md`

## Goal
Add the PricingSection and PaygPricingSection wired to `billing_config`, structured data (JSON-LD), full meta tag set including hreflang, robots.txt + sitemap.xml, and Vite SSG prerendering for SEO.

## Single source of truth
`ARCHITECTURE.md` sections 7, 9.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Pricing sections
- `frontend/src/components/landing/PricingSection.tsx` — three tier cards (Free, Pro BYO, Pro Managed) reading from `shared/constants/pricing.ts` + override values fetched from `/api/landing/pricing` (a public endpoint that surfaces PLANS + `billing_config.payg_rates` for display).
- `frontend/src/components/landing/PaygPricingSection.tsx` — table of PAYG rates per event type, with worked examples.
- Currency formatting locale-correct.

### 2. Public pricing endpoint
- `gateway/src/api/landing/pricing.ts`:
  - `GET /api/landing/pricing` — returns `{ plans, paygRates, currency, trialDays }` from `shared/constants/pricing.ts` + `billing_config`.
  - Public, cached 5 minutes.

### 3. Structured data
- `frontend/src/components/landing/StructuredData.tsx`:
  - schema.org `WebApplication` + `Organization` + `FAQPage` (sourced from FAQSection content) emitted as JSON-LD `<script>` tags in `<head>`.

### 4. Meta tags
- Per-locale `<title>`, `<description>`, OpenGraph, Twitter Card, canonical.
- `<link rel="alternate" hreflang="en|ar|fr|de|es|x-default" href="…">` for every public route × every locale.
- Use Vite's `index.html` template with a per-locale build OR client-side injection via a `<HelmetProvider>`-style component (check repo first).

### 5. robots.txt + sitemap.xml
- `frontend/public/robots.txt` — allow all + sitemap pointer.
- `scripts/generate-sitemap.ts` — generates `frontend/public/sitemap.xml` listing every public route × every locale with `hreflang` `<xhtml:link>` entries.
- Run during build.

### 6. Vite SSG prerendering
- Add a prerender step that statically renders `/`, `/pricing` (if separated), `/login`, `/signup` for every locale into HTML files. The test runner verifies the prerendered files exist and contain expected meta tags.

### Files to create/modify
- `gateway/src/api/landing/pricing.ts` — new
- `frontend/src/components/landing/{PricingSection,PaygPricingSection,StructuredData}.tsx` — new
- `frontend/src/pages/landing/LandingPage.tsx` — extended
- `frontend/index.html` — meta scaffolding
- `frontend/public/robots.txt` — new
- `scripts/generate-sitemap.ts` — new
- `frontend/vite.config.ts` — prerender plugin wiring
- `frontend/public/locales/{en,ar,fr,de,es}/landing.json` — extend with pricing strings

### Tests
- Vitest: PricingSection renders correct values per locale; currency format correct.
- Vitest: StructuredData emits valid JSON-LD; schema.org validator (offline JSON-schema validator) accepts it.
- Supertest: `/api/landing/pricing` returns expected shape + headers (cache-control set).
- Build test: after `bun run build`, sitemap.xml exists + lists every locale × every public route; prerendered HTML files exist with correct `<title>` per locale.
- Playwright: open prerendered HTML directly (no JS); meta tags present.
- Coverage: 100% on touched files.

### i18n
- All pricing strings localized; hreflang correct.

### Documentation
- `docs/{en,ar,fr,de,es}/landing/seo.md`

### Acceptance criteria
- [ ] Pricing sections wired to live billing_config.
- [ ] Structured data validates.
- [ ] hreflang complete and correct.
- [ ] robots.txt + sitemap.xml present and accurate.
- [ ] Prerendered HTML files exist per locale.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
