# Validate: Landing SEO + Lighthouse

## Agent
`design-ui-designer` (verifier) + `api-designer`

## Depends on
`53-landing-pricing-payg-comparison-seo-meta.md`

## Goal
Verify SEO infrastructure is complete: structured data validates, hreflang correct, sitemap accurate, Lighthouse scores meet targets.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component + structured-data tests pass.

### 2. Build artifacts
- `bun run build` → exit 0
- `frontend/dist/sitemap.xml` exists; lists every public route × every locale; `<xhtml:link>` hreflang entries correct.
- Prerendered HTML files for every locale × every public route exist with localized `<title>`, `<meta description>`, OG tags, canonical, hreflang.

### 3. Structured data
- Run a JSON-LD validator (offline JSON-schema-based or `schema-dts` test) against the rendered output of LandingPage; assert `WebApplication`, `Organization`, `FAQPage` all parse.

### 4. Lighthouse CI
- Run Lighthouse on the prerendered `/` for each locale (mobile + desktop):
  - Performance ≥ 95
  - SEO = 100
  - Accessibility ≥ 95
  - Best practices ≥ 95
- Save report; fail validation on regression.

### 5. hreflang correctness
- For each public route, assert that for every locale, the hreflang link exists in its prerendered HTML AND points at a real URL that exists in the sitemap.

### 6. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Lighthouse meets targets.
- [ ] Structured data valid.
- [ ] hreflang complete and correct.
- [ ] No regressions.

## On failure
- Re-open `53-landing-pricing-payg-comparison-seo-meta.md`; fix; rerun.
- Do NOT advance to phase 10 until this validation passes.
