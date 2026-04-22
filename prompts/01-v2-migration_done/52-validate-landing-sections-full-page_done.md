# Validate: Landing sections + full page

## Agent
`design-ui-designer` (verifier) + `translation-manager`

## Depends on
`51-landing-features-trustbar-comparison-testimonials-faq-cta-emailcapture.md`

## Goal
Verify every landing section renders cleanly across 5 languages × themes × directions, axe is clean, email capture works end-to-end.

## Validation steps

### 1. Static + unit
- `bun typecheck`, `bun lint` → exit 0
- Component tests pass.

### 2. Visual matrix
- Playwright full-page screenshots: 5 languages × light/dark × ltr (and rtl for ar) × desktop+mobile.
- Visual diff against baseline (first run sets baseline).

### 3. Email capture e2e
- Submit valid email → success toast → DB row exists with correct locale + source.
- Submit duplicate → success toast (idempotent).
- Submit invalid → inline validation error.
- Rate-limit: 6th rapid submission → 429 + UI toast.
- Disable feature flag → form hidden or returns 403 gracefully.

### 4. Accessibility
- Axe scan on full page: zero violations.
- Lighthouse mobile a11y ≥ 95.

### 5. i18n completeness
- `landing.json` parity test passes; no English in non-English locales (modulo glossary).

### 6. Coverage + regression
- 100% on touched files; no regressions.

## Pass criteria
- [ ] Visual matrix passes.
- [ ] Email capture works and is rate-limited.
- [ ] Axe + i18n parity clean.
- [ ] No regressions.

## On failure
- Re-open `51-landing-features-trustbar-comparison-testimonials-faq-cta-emailcapture.md`; fix; rerun.
- Do NOT advance to prompt 53 until this validation passes.
