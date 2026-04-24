# Recon — Landing-page feature section

## Agent
No dedicated landing agent in `.claude/agents/` — drive via the skills below. (Per the precedent set in `prompts/05-landing-page-redesign_done/02-hero-and-cta_done.md`.)

## Skills
- Primary: `.claude/skills/landing-page-optimization/`, `.claude/skills/copywriting/`
- Supporting: `.claude/skills/programmatic-seo/`, `.claude/skills/page-cro/`, `.claude/skills/shadcn-design-system-compliance/`, `.claude/skills/popup-cro/` (for the optional "Get a free pentest sample" CTA)
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/recon-safety.md` (A7 — banned vocabulary)

## Dependencies
- A7 (banned-vocabulary rule must exist)

## Task
Add a new lazy-loaded landing-page section that markets Recon. Brand it strictly as **Recon by whynot** — our product, built in-house. **Do NOT** mention Shannon, KeygraphHQ, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, or Claude. **Do NOT** describe the underlying multi-agent architecture or model tiers. Lead with outcomes (proof-by-exploit findings, on-demand cadence, white-box source-aware analysis) — not implementation.

### 1. File
- `frontend/src/components/landing/ReconFeatureSection.tsx`
- Update `frontend/src/pages/landing/LandingPage.tsx` to lazy-import and render between `FeaturesSection` and `ComparisonSection`.

### 2. Section structure
- Eyebrow chip: "New" or "Now in beta"
- Headline: short, benefit-led — see i18n keys below for the canonical copy.
- Sub-headline: 1–2 sentences clarifying the value prop.
- Three benefit cards (no `hover:-translate-y-*`, no `hover:shadow-*`):
  1. **Proof, not theory** — "Every finding ships with a working exploit you can re-run."
  2. **Source-aware** — "We scan your codebase to focus the test on what matters."
  3. **On-demand** — "Run a pentest before every release, not once a year."
- Optional split-screen: copy on start side, animated screenshot of a finding card on the end side. Use `<Reveal>` from foundation. Reduced-motion friendly.
- Single primary CTA: "Try Recon" → `/signup?ref=recon` or `/recon` for authenticated users.
- Secondary CTA: "See a sample report" → opens a modal with a redacted sample (or links to `/docs/recon/sample-report`).

### 3. Visual style
- `bg-background` or `bg-muted` (no gradient).
- No glassmorphism.
- `rounded-lg` cards (max), `shadow-sm` only.
- Headline weight: `font-semibold` (no display fonts, no gradient text).
- Severity color samples in the screenshot use the same soft palette as A6.

### 4. SEO
- Section uses semantic `<section aria-labelledby="recon-feature-heading">`.
- Add structured data (JSON-LD) for a `SoftwareApplication` feature: name, description, applicationCategory `SecurityApplication`, offers (mirroring B3 quotas).
- Update `StructuredData.tsx` (existing) to include the Recon block.

### 5. RTL
- All logical properties.
- Screenshot mirrors via `rtl:scale-x-[-1]` ONLY if a directional element is present; symmetric screenshots stay un-mirrored.

### 6. Banned-vocabulary CI guard
Add a test that greps the rendered output (via `render(...).container.innerHTML`) for the banned strings; fails if any match.

### Tests
- Vitest:
  - Section renders all 3 benefit cards.
  - CTA route is `/signup?ref=recon` for unauth; `/recon` for auth.
  - Sample-report modal opens + closes; trapped focus.
  - Banned-vocabulary regex returns no matches.
  - Reduced-motion: no `motion.*` wrappers when `matchMedia` returns reduced.
  - Snapshot in en + ar.
- Playwright (under `frontend/e2e/landing/recon.spec.ts`):
  - Section visible at all breakpoints (360/768/1024/1440).
  - CTA navigates correctly.
  - `axe-core` zero critical violations in en + ar.
  - Visual regression in light + dark × en + ar.
- 100% coverage on new files.

### i18n
Add to `frontend/public/locales/{en,ar,fr,de,es}/landing.json`:
- `landing.recon.eyebrow` — "New"
- `landing.recon.title` — "Pentest every release. Not once a year."
- `landing.recon.subtitle` — "Recon runs an autonomous, white-box security test against your app and reports only the vulnerabilities it can actually exploit."
- `landing.recon.benefit1.title` — "Proof, not theory"
- `landing.recon.benefit1.body` — "Every finding ships with a working exploit you can re-run."
- `landing.recon.benefit2.title` — "Source-aware"
- `landing.recon.benefit2.body` — "Recon reads your codebase to focus the test on what matters."
- `landing.recon.benefit3.title` — "On-demand"
- `landing.recon.benefit3.body` — "Run a full pentest in about an hour. Repeat as often as you ship."
- `landing.recon.cta.primary` — "Try Recon"
- `landing.recon.cta.secondary` — "See a sample report"
- `landing.recon.sampleReport.title`, `.close`
- 5 locales. **Translation manager (`.claude/agents/translation-manager.md`) MUST verify zero banned vocabulary in any locale.**

### Documentation
- E3 covers `/docs/recon/sample-report.md`.

### Files to modify
- See file list in section 1.
- `frontend/src/components/landing/StructuredData.tsx` (additions).
- 5 frontend `landing.json` locale files.
- Tests.
