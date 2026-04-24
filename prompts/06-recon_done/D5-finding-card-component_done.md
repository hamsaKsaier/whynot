# Recon — Finding card component

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/finding-severity/` (A5)
- Supporting: `.claude/skills/shadcn-design-system-compliance/`
- Rules: `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`

## Dependencies
- A1, A5, A6, B1

## Task
Build the reusable `<ReconFindingCard>` component used by D4. Encapsulates the severity badge, vuln-class chip, normalized endpoint, PoC viewer with copy-to-clipboard, reproducibility steps, and remediation summary.

### 1. File
- `frontend/src/components/recon/ReconFindingCard.tsx`
- `frontend/src/components/recon/ReconSeverityBadge.tsx` (small, used here + in D2/D4)
- `frontend/src/components/recon/ReconPoCViewer.tsx`

### 2. Props
```ts
type ReconFindingCardProps = {
  finding: ReconFinding;     // shape from C6 API
  defaultExpanded?: boolean;
  onCopyPoC?: () => void;    // analytics hook
};
```

### 3. Layout
Per `.claude/skills/recon-ui/references/finding-card.md`:
- Container: `Card` with `rounded-lg border bg-card shadow-sm`. **No** `hover:-translate-y-*`, **no** `hover:shadow-md`, **no** `transition-all`.
- Header row (`flex items-center gap-3`):
  - `<ReconSeverityBadge severity={finding.severity} />`
  - `<Badge variant="outline">{vulnClassLabel}</Badge>`
  - `<code>{finding.normalizedEndpoint}</code>` (truncated with title attribute for full)
  - "Copy endpoint" icon button on the end side
- Body: `finding.description` (1–2 lines, truncated with "Show more" toggle).
- Collapsible section: `<ReconPoCViewer>`.
- Footer row: remediation summary (1 line + "View details" link).

### 4. ReconSeverityBadge
- Maps severity to color per A6:
  - `low` → slate
  - `medium` → amber
  - `high` → orange
  - `critical` → red
- Uses Shadcn `Badge` `variant="outline"` with the soft fill `bg-{color}-50 text-{color}-900 dark:bg-{color}-900/20 dark:text-{color}-300`.
- No animation, no pulse, no ring.

### 5. ReconPoCViewer
- Renders `finding.proofOfConcept` based on its discriminated `kind`:
  - `code` → Shiki code block with language hint.
  - `http` → request/response pair, formatted.
  - `script` → terminal-style block with monospace.
- Copy button in the start-end corner. Uses `navigator.clipboard.writeText`. Toast on success ("Copied" / 5 langs).
- Sandboxed: payload renders inside `<pre>` with `white-space: pre-wrap` — never inserted as `dangerouslySetInnerHTML`.

### 6. Accessibility
- The card is a `<section>` with `aria-labelledby` pointing to a hidden span that contains the severity + endpoint.
- The collapsible PoC uses `aria-expanded`.
- The copy button has `aria-label` from i18n.

### 7. RTL
- All paddings/margins via logical properties.
- Code block direction is always LTR (force `dir="ltr"` on `<pre>` because code is left-to-right even in Arabic UIs).

### Tests
- Renders all 4 severities with correct color classes.
- Code/http/script PoC kinds each render correctly (snapshot).
- Copy button writes to clipboard (mock `navigator.clipboard`); fires `onCopyPoC` analytics hook.
- "Show more" expands the description.
- A11y: zero critical `axe-core` violations in en + ar.
- Switch styling rule: PoC viewer never uses `min-h-[44px]` on a Switch (no Switch in this component, but assert by absence so future regressions are caught).
- Verify NO banned classNames are present: `hover:-translate-y-*`, `hover:shadow-md`, `animate-pulse` (on the Card), `transition-all`, `rounded-2xl`, `rounded-3xl`, `rounded-full` (on the Card), `bg-gradient-to-*`, `backdrop-blur`, `scale-*` on hover.
- 100% coverage.

### i18n
Add to `frontend/public/locales/{en,ar,fr,de,es}/recon.json`:
- `recon.findingCard.copy.endpoint`, `.copy.poc`, `.showMore`, `.showLess`, `.viewDetails`, `.remediation`, `.poc.copied`
- `recon.vulnClass.injection`, `.xss`, `.ssrf`, `.auth`, `.authz` (already added in C3 — verify)
- `recon.severity.*` (already added in A5 — verify)
- 5 locales. No banned vocabulary.

### Documentation
- E3: screenshot of the finding card on the "Understanding findings" page.

### Files to modify
- See file list in section 1.
- 5 frontend `recon.json` locale files.
- Tests under `frontend/src/components/recon/__tests__/`.
