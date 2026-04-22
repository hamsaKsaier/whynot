# 08 — Design System: Admin Frontend Uncodixify Pass

## Agent
`design-ui-designer`

## Skills referenced
- `.claude/skills/shadcn-design-system-compliance/`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/rtl-support-arabic.md`
- STYLES.md

## Task

Mirror of prompt 07, applied to `admin-frontend/src/**`. Admin frontend hosts both the normal admin area and the superadmin namespace (Users, Organizations, Plans, Subscriptions, Credits, BillingConfig, FeatureFlags, AIProviders, AuditLog, Analytics, UsageTracking, Announcements, SystemSettings) — these pages were rewritten by `prompts/01-v2-migration/15` and `43-48` but still contain legacy patterns.

### Scope / Requirements

1. **Full audit of `admin-frontend/src/**`**
   - Same forbidden-pattern list as prompt 07.
   - Particular attention to: `admin-frontend/src/components/layout/AdminShell.tsx`, `admin-frontend/src/pages/*.tsx` (all 13+ pages), `admin-frontend/src/components/**` shared primitives.
   - Produce a pre-fix violation report.

2. **Fix each violation**
   - Apply the same mappings as prompt 07:
     - Banned animations / transitions / shadows / radii → approved equivalents.
     - Gradients, glassmorphism → solid tokens.
     - `text-white`/`bg-white`/`bg-black` / hardcoded hex → semantic tokens.
     - Physical classes → logical properties.
     - Missing `rtl:scale-x-[-1]` → added.
     - `rtl:flex-row-reverse` → removed.

3. **AdminShell layout**
   - Verify sidebar uses sidebar tokens from STYLES.md (`--sidebar-background`, `--sidebar-foreground`, etc).
   - No floating icon-only collapse gimmick; prefer a static left rail per `.claude/rules/uncodixify-ui.md`.
   - Top nav and section headers follow STYLES.md typography (`text-2xl font-semibold` for page titles, `text-lg font-semibold` for section headings).

4. **Superadmin pages**
   - Each superadmin page must match the Shadcn card/table patterns in STYLES.md.
   - Tables use `text-start`/`text-end`, not `text-left`/`text-right`.
   - Row actions are inline buttons, not 3-dot dropdown menus (per Client Dashboard Patterns in `.claude/rules/spec-driven-development.md`).
   - Status badges use the status badge pattern from STYLES.md (`bg-green-50 dark:bg-green-900/20`, etc).

5. **Form components**
   - Every form input wrapped in `<FormField>` / `<FormItem>` / `<FormLabel>` / `<FormMessage>` (shadcn Form pattern).
   - No custom styling overrides — use variants instead.

6. **Lint enforcement**
   - Same custom lint rule as prompt 07, applied to `admin-frontend/src/**`. Share the rule module between both frontends to avoid drift.

### Tests (MANDATORY — 100% coverage for touched files)
- **Static scan test**: `admin-frontend/src/__tests__/design-system-compliance.test.ts`.
- **Visual regression**: Playwright snapshots for the 13 superadmin pages and all non-superadmin admin routes, light + dark mode, 1280x800 and 375x667.
- **RTL parity**: same suite with `lang=ar`.
- **Role gating**: confirm non-superadmin users cannot render the 13 superadmin pages; assertions on the `ProtectedRoute` wrapper.
- **Unit**: for each refactored component, assert className doesn't contain banned patterns.

### i18n (5 languages)
- Coordinate with prompt 01 (English key extraction for admin) and prompt 02-05 (ar/fr/de/es translations).
- Run the full admin UI through each language's visual regression suite.
- Long German strings must not overflow on mobile (coordinate with prompt 04).

### Documentation
- `/docs/en/design/uncodixify-audit-admin.md` — summary of admin sweep.
- 5-language variants: `/docs/{ar,fr,de,es}/design/uncodixify-audit-admin.md`.

### Constraints
- Docker-only: `make shell-admin`.
- Every style change maps to STYLES.md token.
- No functional behavior changes.
- Respect service component patterns where applicable.

### Verification steps
1. `make shell-admin npm run typecheck`
2. `make shell-admin npm run lint`
3. `make shell-admin npm test`
4. `make shell-admin npm test -- design-system-compliance`
5. `make shell-admin npm run test:visual`
6. `make rtl-check`
7. Manual smoke: `make start`, log in as a super_admin to `http://localhost:5184`, visit every superadmin page, toggle light/dark, switch through all 5 languages.
8. `grep -rEn "hover:-translate-y|hover:shadow-md|hover:shadow-lg|animate-bounce|rounded-2xl|rounded-3xl|bg-gradient-to|backdrop-blur|transition-all" admin-frontend/src` returns zero hits.
