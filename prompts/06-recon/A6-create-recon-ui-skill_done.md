# Recon — Create the `recon-ui` skill

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/shadcn-design-system-compliance/`, `.claude/skills/whynot-dashboard/`
- Supporting: `.claude/skills/landing-page-optimization/` (for tone)
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`, `.claude/rules/switch-component-styling.md`

## Dependencies
- A1, A5

## Task
Create a skill that codifies the UI patterns Recon uses: phase-progress timelines, severity badges, finding cards, PoC viewers, report viewers. Future D-section prompts cite this skill verbatim.

### 1. Files to create
- `.claude/skills/recon-ui/SKILL.md`
- `.claude/skills/recon-ui/references/severity-badge.md`
- `.claude/skills/recon-ui/references/phase-timeline.md`
- `.claude/skills/recon-ui/references/poc-viewer.md`
- `.claude/skills/recon-ui/references/finding-card.md`

### 2. SKILL.md — required content

**Severity badges.** Map each severity to a Shadcn `Badge` variant + semantic color. No animation, no pulse. Use `bg-{color}-50 text-{color}-900 dark:bg-{color}-900/20 dark:text-{color}-300` for soft fills:
- `low` → slate
- `medium` → amber
- `high` → orange
- `critical` → red

**Phase timeline.** A vertical or horizontal stepper showing the 5 phases with status (pending / running / completed / failed / skipped / cancelled). Use `Loader2 animate-spin` for the running phase. No bouncing icons. Logical properties (`ms-*`, `me-*`) for RTL. Connector lines use `border-border`.

**Finding card.** Layout:
- Header row: severity badge, vuln class chip, normalized endpoint, copy-to-clipboard button.
- Body: short description (1–2 lines), then collapsible PoC viewer.
- Footer: remediation summary, "View full report" link.
- `rounded-lg border bg-card shadow-sm` — flat, no hover lift, no shadow escalation.

**PoC viewer.** Code block using the same syntax-highlighter as the rest of whynot (Shiki — already a project dependency for Fumadocs blogs). Copy button in the top-end corner. Language detection driven by the `proof_of_concept.language` field.

**Report viewer.** Markdown rendering using the project's existing markdown renderer. Sticky table of contents on the start side at `lg+`.

**Tabs.** Every tabbed surface in Recon must follow `.claude/rules/url-tab-state.md`. List the search-param schemas:
- `/recon` page tabs: `?tab=running|completed|failed|all`
- `/recon/:scanId` page tabs: `?tab=findings|phases|report|raw`

**Authorization checkbox.** A custom controlled `Switch` per `.claude/rules/switch-component-styling.md` (no `min-h-[44px]` directly on the Switch — touch target via parent). The free-text justification is a `Textarea` with min-20-char client validation mirroring the server.

### 3. References
Each reference file is a self-contained component spec with TypeScript prop types and a Vitest test outline.

### Tests
- The skill must instruct downstream prompts to test each pattern at the component level + as part of pages.

### i18n
- The skill lists the canonical key prefixes:
  - `recon.severity.*`, `recon.phases.*`, `recon.findings.*`, `recon.scan.*`, `recon.report.*`
  - All 5 locales (en/ar/fr/de/es). RTL verified for `ar`.

### Documentation
- The skill must instruct downstream UI work to update `/docs/recon/` screenshots when component appearance changes materially.

### Files to modify
- Create the five files listed above under `.claude/skills/recon-ui/`.
