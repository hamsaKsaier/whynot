# Recon — Documentation pages

## Agent
`blog-developer` (`.claude/agents/content/blog-developer.md`) — owns the Fumadocs MDX docs site.
`translation-manager` (`.claude/agents/translation-manager.md`) — owns the 5-language coverage gate.

## Skills
- Primary: `.claude/skills/copywriting/`, `.claude/skills/programmatic-seo/`
- Supporting: `.claude/skills/landing-page-optimization/`
- Rules: `.claude/rules/recon-safety.md` (A7 — banned vocabulary)

## Dependencies
- A4, A5, A7, B3, C-section (all phases must exist for accurate docs), D-section (UI screenshots)

## Task
Create the `/docs/recon/` documentation tree in all 5 supported languages. Brand strictly as Recon — never name underlying tools.

### 1. Pages to create (in each of `en/ar/fr/de/es`)
- `quickstart.md` — "Run your first scan in 5 minutes." Walks through the wizard (D3) with screenshots.
- `responsible-use.md` — "Authorization & responsible use." Explains the per-scan authorization gate, the audit log, and the user's legal obligations. Links to plain-language summaries of the relevant laws (CFAA + EU equivalents).
- `understanding-findings.md` — Severity rubric (per A5), exploit-outcome semantics (per C4), false-positive policy.
- `reading-reports.md` — Report structure (per C5), how to share, how to download PDF.
- `quotas.md` — Plan inclusions + PAYG rates (per B3), partial-scan billing.
- `ci-integration.md` — Future-facing: how to trigger scans from CI (deferred — show "Coming soon" stub with a sign-up form for the beta).
- `troubleshooting.md` — Common failures (stuck scan, authorization missing, repo not connected, environment URL missing) and how to fix.
- `sample-report.md` — A redacted example report (referenced by E1's "See a sample report" CTA).

### 2. File layout
Match the existing docs convention. Most likely:
- `docs/{lang}/recon/<page>.md`
or
- `apps/docs/content/{lang}/recon/<page>.mdx`
Confirm via `find . -path '*/docs*' -name 'quickstart*'` before writing.

### 3. Banned vocabulary
Per `.claude/rules/recon-safety.md` rule #6:
- NEVER mention: Shannon, KeygraphHQ, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, Claude.
- Use generic phrasing: "our security tooling", "automated reconnaissance", "headless-browser execution", "language-model reasoning."

### 4. Cross-linking
- Quickstart links to Responsible use + Understanding findings.
- Understanding findings links to Reading reports.
- Quotas links to the live pricing page (E2).
- Troubleshooting cross-links to all of the above.

### 5. Translation discipline
- English is source of truth.
- Each translated page MUST be a true translation, not a transliteration. The `translation-manager` agent owns this.
- RTL Arabic: ensure the docs renderer applies `dir="rtl"` correctly; verify code blocks remain LTR.

### Tests
- Build the docs site in CI; fail on broken internal links.
- Custom CI test: grep the entire `/docs/recon/` tree for banned vocabulary; fail on any match.
- Custom CI test: assert each English page has a counterpart in `ar/fr/de/es` (filename match).
- Snapshot of one page in each language to catch unintentional formatting drift.
- 100% link integrity (no 404s in markdown links).

### i18n
- The docs themselves ARE the i18n; no separate locale JSON.
- Frontend page-routing strings (if Fumadocs uses i18n keys for nav) added to the appropriate locale namespace.

### Documentation
- This prompt IS the documentation prompt.

### Files to modify
- 8 markdown files × 5 languages = 40 files.
- Docs nav config (Fumadocs sidebar) in each language.
- CI test files for the banned-vocab + 5-lang-parity gates.
