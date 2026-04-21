> **Single source of truth**: Before proposing any change, read [`../../../ARCHITECTURE.md`](../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

---
name: recon-ui
description: "UI component patterns for the Recon penetration-testing feature: severity badges, phase timelines, finding cards, PoC viewers, report viewers, and scan list pages. Activate when building any Recon frontend component. Keywords: recon, severity badge, phase timeline, finding card, PoC viewer, report viewer, scan list, vulnerability, pentest UI."
metadata:
  version: "1.0.0"
  author: "whynot Team"
  category: "recon-ui"
  dependencies: "react@18+, typescript, tailwindcss, shadcn/ui, shiki"
  project: "whynot Recon"
---

# Recon UI Skill

You are an expert in building Recon's penetration-testing UI components. Your goal is to implement every Recon-facing component following the patterns defined in this skill. All downstream D-section prompts cite this skill verbatim.

## When to Use This Skill

- Building any Recon UI component (severity badges, phase timelines, finding cards, PoC viewers, report viewers)
- Creating Recon pages (scan list, scan detail, new-scan wizard)
- Implementing Recon-specific tabs, filters, or authorization controls
- Adding i18n keys for Recon UI strings
- Testing Recon components at the unit and page level

## Governing Rules

Every Recon component MUST comply with:

| Rule | Path | Key Constraint |
|------|------|----------------|
| Uncodixify UI | `.claude/rules/uncodixify-ui.md` | No hover lift, no shadow escalation, no gradient text, no glassmorphism |
| RTL Support | `.claude/rules/rtl-support-arabic.md` | Logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`); no `rtl:flex-row-reverse`; directional icons mirrored |
| URL Tab State | `.claude/rules/url-tab-state.md` | Every tabbed surface uses `validateSearch` + `navigate({ replace: true })` |
| Switch Styling | `.claude/rules/switch-component-styling.md` | No `min-h-[44px]` on Switch; touch target via parent container |

## Component Catalog

### 1. Severity Badge

Renders a Shadcn `Badge` with soft-fill semantic color for each severity level.

**Color Map:**

| Severity | Color | Classes |
|----------|-------|---------|
| `low` | slate | `bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300` |
| `medium` | amber | `bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300` |
| `high` | orange | `bg-orange-50 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300` |
| `critical` | red | `bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300` |

**Constraints:**
- Shadcn `Badge` with `variant="outline"` plus the soft-fill classes above.
- **No animation.** No `animate-pulse`, no `animate-bounce`.
- Directional icons inside the badge are mirrored with `rtl:scale-x-[-1]`.

Full spec: [`references/severity-badge.md`](references/severity-badge.md)

### 2. Phase Timeline

A stepper showing the 5 Recon phases (`fingerprinting` → `discovery` → `vuln_analysis` → `exploitation` → `reporting`) with their current status.

**Phase States:** `pending` | `running` | `completed` | `failed` | `skipped` | `cancelled`

**Layout:**
- Vertical on `< lg` screens, horizontal on `lg+`.
- Each step shows: status icon, phase label (i18n), timestamp, duration (if completed), error message (if failed).

**Status Icons:**
| Status | Icon | Animation |
|--------|------|-----------|
| `pending` | `Clock` | None |
| `running` | `Loader2` | `animate-spin` |
| `completed` | `CheckCircle` | None |
| `failed` | `XCircle` | None |
| `skipped` | `SkipForward` | None |
| `cancelled` | `Ban` | None |

**Constraints:**
- `Loader2 animate-spin` for running — **no bouncing icons ever**.
- Connector lines use `border-border`.
- All spacing uses logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- The `running` step's icon must have `aria-label="Loading"` for accessibility.

Full spec: [`references/phase-timeline.md`](references/phase-timeline.md)

### 3. Finding Card

Displays a single vulnerability finding with severity, vuln class, endpoint, PoC, and remediation.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ [SeverityBadge] [VulnClass]  GET /api/users/:id  [Copy] │  ← Header
│                                                         │
│ Short description of the finding...                     │  ← Body
│ ┌─ Proof of Concept ───────────────────── [Copy] ──┐   │
│ │ curl -X GET https://target/api/users/1            │   │  ← Collapsible PoC
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ Remediation: Apply parameterized queries... [Details]   │  ← Footer
└─────────────────────────────────────────────────────────┘
```

**Container:** `Card` with `rounded-lg border bg-card shadow-sm`.

**Banned on this component:**
- `hover:-translate-y-*`
- `hover:shadow-md` or `hover:shadow-lg`
- `transition-all`
- `animate-pulse` (on the card itself)
- `rounded-2xl`, `rounded-3xl`, `rounded-full` (on the card)
- `bg-gradient-to-*`
- `backdrop-blur`
- `scale-*` on hover

Full spec: [`references/finding-card.md`](references/finding-card.md)

### 4. PoC Viewer

A syntax-highlighted code block for proof-of-concept payloads.

**Implementation:**
- Uses **Shiki** (already a project dependency for Fumadocs blogs).
- Language detection driven by the `proof_of_concept.language` field.
- Copy button in the **top-end corner** (uses logical `end` positioning for RTL).
- Code direction is always **LTR**: `dir="ltr"` on the `<pre>` element because code reads left-to-right even in Arabic UIs.
- Payload renders inside `<pre>` with `white-space: pre-wrap` — **never** `dangerouslySetInnerHTML`.

**PoC Kinds (discriminated union):**
| Kind | Rendering |
|------|-----------|
| `code` | Shiki code block with language hint |
| `http` | Formatted request/response pair |
| `script` | Terminal-style block, monospace font |

Full spec: [`references/poc-viewer.md`](references/poc-viewer.md)

### 5. Report Viewer

Renders the final scan report as Markdown with a sticky table of contents.

**Implementation:**
- Uses the project's existing Markdown renderer.
- Sticky TOC on the **start side** at `lg+` breakpoint.
- Available only when scan status is `completed`; otherwise shows skeleton + message.
- All markdown content uses `prose` classes with `dark:prose-invert`.

### 6. Authorization Control

A controlled Switch + Textarea for scan authorization.

**Switch:**
- Follows `.claude/rules/switch-component-styling.md` strictly.
- Touch target achieved via parent container (`min-h-[44px]` on the parent `<div>`, never on the `<Switch>` itself).
- The Switch element only uses allowed customizations: `data-[state=checked]:bg-*` for custom colors.

**Textarea:**
- Free-text justification field.
- Client-side validation: minimum 20 characters (mirrors server-side validation).
- Shows character count below the field: `{length}/20 minimum`.
- Error state via Shadcn `FormMessage` when under 20 characters and user has blurred the field.

### 7. Scan Status Badge

For scan-level status (distinct from finding severity). Uses the same soft-fill pattern:

| Status | Color | Classes |
|--------|-------|---------|
| `pending` | slate | `bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300` |
| `running` | blue | `bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300` |
| `completed` | green | `bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300` |
| `failed` | red | `bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300` |
| `cancelled` | slate | `bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300` |
| `stuck` | amber | `bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300` |

## URL Tab Schemas

Every tabbed surface in Recon MUST follow `.claude/rules/url-tab-state.md`.

### `/recon` — Scan List Page

```typescript
type ReconListTab = "running" | "completed" | "failed" | "all";

validateSearch: (search: Record<string, unknown>) => ({
  tab: (["running", "completed", "failed", "all"].includes(search.tab as string)
    ? search.tab
    : "all") as ReconListTab,
})
```

### `/recon/:scanId` — Scan Detail Page

```typescript
type ReconDetailTab = "findings" | "phases" | "report" | "raw";

validateSearch: (search: Record<string, unknown>) => ({
  tab: (["findings", "phases", "report", "raw"].includes(search.tab as string)
    ? search.tab
    : undefined) as ReconDetailTab | undefined,
})
```

Default tab is determined by scan status:
- `running` / `pending` → `phases`
- `completed` → `findings`
- `failed` / `cancelled` / `stuck` → `phases`

Both pages use `navigate({ replace: true })` on tab change.

## Testing Requirements

Every Recon component MUST be tested at two levels:

### Component-Level Tests
- Render each variant (severity levels, phase statuses, PoC kinds).
- User interactions: copy-to-clipboard, collapsible sections, tab changes.
- Accessibility: zero critical `axe-core` violations in both `en` and `ar` locales.
- Snapshot tests in `en` + `ar` (RTL verification).
- Assert **absence** of banned CSS classes (Uncodixify compliance):
  - `hover:-translate-y-*`, `hover:shadow-md`, `animate-pulse` (on badges/cards), `transition-all`, `rounded-2xl`, `rounded-3xl`, `rounded-full` (on containers), `bg-gradient-to-*`, `backdrop-blur`, `scale-*` on hover.
- 100% coverage target.

### Page-Level Tests
- Tab URL sync (navigate to `?tab=X`, verify correct tab is active).
- Default tab based on scan status.
- Polling behavior (5s while active, stops when terminal or tab hidden).
- Stuck banner renders when `status === 'stuck'`.
- Cancel/Resume actions disabled appropriately.

## i18n Key Prefixes

All Recon UI strings use these canonical key prefixes:

| Prefix | Purpose | Example Keys |
|--------|---------|--------------|
| `recon.severity.*` | Severity labels | `recon.severity.low`, `recon.severity.medium`, `recon.severity.high`, `recon.severity.critical` |
| `recon.phases.*` | Phase names + statuses | `recon.phases.fingerprinting`, `recon.phases.discovery`, `recon.phases.vuln_analysis`, `recon.phases.exploitation`, `recon.phases.reporting`, `recon.phases.status.pending`, `recon.phases.status.running`, `recon.phases.status.completed`, `recon.phases.status.failed`, `recon.phases.status.skipped`, `recon.phases.status.cancelled` |
| `recon.findings.*` | Finding-related strings | `recon.findings.title`, `recon.findings.empty`, `recon.findings.filter.severity`, `recon.findings.filter.vulnClass`, `recon.findings.sort.severity`, `recon.findings.sort.chronological` |
| `recon.scan.*` | Scan-level strings | `recon.scan.new`, `recon.scan.cancel`, `recon.scan.resume`, `recon.scan.rerun`, `recon.scan.downloadPdf`, `recon.scan.status.pending`, `recon.scan.status.running`, `recon.scan.status.completed`, `recon.scan.status.failed`, `recon.scan.status.cancelled`, `recon.scan.status.stuck` |
| `recon.report.*` | Report viewer strings | `recon.report.title`, `recon.report.notReady`, `recon.report.toc` |
| `recon.findingCard.*` | Finding card micro-copy | `recon.findingCard.copy.endpoint`, `recon.findingCard.copy.poc`, `recon.findingCard.showMore`, `recon.findingCard.showLess`, `recon.findingCard.viewDetails`, `recon.findingCard.remediation`, `recon.findingCard.poc.copied` |
| `recon.vulnClass.*` | Vulnerability class labels | `recon.vulnClass.injection`, `recon.vulnClass.xss`, `recon.vulnClass.ssrf`, `recon.vulnClass.auth`, `recon.vulnClass.authz` |
| `recon.auth.*` | Authorization strings | `recon.auth.confirm`, `recon.auth.justification.label`, `recon.auth.justification.placeholder`, `recon.auth.justification.minLength` |
| `recon.detail.*` | Detail page strings | `recon.detail.breadcrumb.scan`, `recon.detail.tab.findings`, `recon.detail.tab.phases`, `recon.detail.tab.report`, `recon.detail.tab.raw` |
| `recon.detail.raw.*` | Raw artifacts tab | `recon.detail.raw.col.phase`, `recon.detail.raw.col.kind`, `recon.detail.raw.col.size`, `recon.detail.raw.col.createdAt`, `recon.detail.raw.col.download`, `recon.detail.raw.largeDownload.title`, `recon.detail.raw.largeDownload.body`, `recon.detail.raw.largeDownload.confirm`, `recon.detail.raw.largeDownload.cancel` |

### Locale Files

All keys must exist in **all 5 locales**:

```
frontend/public/locales/{en,ar,fr,de,es}/recon.json
admin-frontend/public/locales/{en,ar,fr,de,es}/recon.json
```

**RTL verification:** Every component must be snapshot-tested in `ar` locale to verify logical properties render correctly when `dir="rtl"`.

## Documentation Requirements

When any Recon component's visual appearance changes materially:

1. Update screenshots in `/docs/recon/` (or create if missing).
2. Update component descriptions in `/docs/en/recon/`, `/docs/ar/recon/`, `/docs/de/recon/`, `/docs/es/recon/`, `/docs/fr/recon/`.
3. The E3 prompt (`prompts/06-recon/E3-docs-pages.md`) coordinates bulk screenshot updates.

## File Organization

```
frontend/src/components/recon/
├── ReconSeverityBadge.tsx
├── ReconScanStatusBadge.tsx
├── ReconPhaseTimeline.tsx
├── ReconFindingCard.tsx
├── ReconPoCViewer.tsx
├── ReconReportViewer.tsx
├── ReconAuthControl.tsx
└── __tests__/
    ├── ReconSeverityBadge.test.tsx
    ├── ReconScanStatusBadge.test.tsx
    ├── ReconPhaseTimeline.test.tsx
    ├── ReconFindingCard.test.tsx
    ├── ReconPoCViewer.test.tsx
    ├── ReconReportViewer.test.tsx
    └── ReconAuthControl.test.tsx

frontend/src/pages/recon/
├── ReconListPage.tsx
├── ReconScanDetailPage.tsx
├── components/
│   ├── PhaseTimeline.tsx
│   └── ReportViewer.tsx
├── hooks/
│   ├── useReconScans.ts
│   └── useReconScan.ts
└── __tests__/
    ├── ReconListPage.test.tsx
    └── ReconScanDetailPage.test.tsx
```

## Related Skills

- **pentest-orchestration** (`pentest-orchestration/`): Phase state machine, checkpointing, heartbeats — the backend model that this UI surfaces.
- **finding-severity** (`finding-severity/`): Severity definitions, scoring rules, and CVSS mapping — the data model behind the severity badge.
- **shadcn-design-system-compliance** (`shadcn-design-system-compliance/`): CSS custom properties, dark mode, accessibility patterns.
- **whynot-dashboard** (`whynot-dashboard/`): API service patterns, React Query hooks, routing, design differentiation.

## References

- [`references/severity-badge.md`](references/severity-badge.md) — TypeScript prop types, color map, test outline
- [`references/phase-timeline.md`](references/phase-timeline.md) — TypeScript prop types, layout spec, test outline
- [`references/poc-viewer.md`](references/poc-viewer.md) — TypeScript prop types, Shiki integration, test outline
- [`references/finding-card.md`](references/finding-card.md) — TypeScript prop types, layout spec, test outline
