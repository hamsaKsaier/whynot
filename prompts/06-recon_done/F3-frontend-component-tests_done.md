# Recon — Frontend component & page tests (Vitest)

## Agent
`frontend-developer` (`.claude/agents/frontend-developer.md`).

## Skills
- Primary: `.claude/skills/recon-ui/` (A6), `.claude/skills/spec-driven-development/`
- Rules: `.claude/rules/recon-safety.md` (A7), `.claude/rules/uncodixify-ui.md`, `.claude/rules/rtl-support-arabic.md`, `.claude/rules/url-tab-state.md`, `.claude/rules/switch-component-styling.md`

## Dependencies
- All of Section D and E1.

## Task
Drive 100% line + branch coverage on every Recon frontend file with Vitest (component + hook + page tests). Adds the cross-cutting tests not already written inside D1–D6.

### 1. Coverage scope
- All files under `frontend/src/pages/recon/**`
- All files under `frontend/src/components/recon/**`
- New code paths in `frontend/src/components/layout/Sidebar.tsx` (D1)
- New tab in `frontend/src/pages/settings/tabs/ReconSettingsTab.tsx` (D6)
- New section `frontend/src/components/landing/ReconFeatureSection.tsx` (E1)

### 2. Cross-cutting tests (in addition to per-file tests in D1–D6)

**Uncodixify compliance grep test** (`frontend/src/components/recon/__tests__/uncodixify.test.ts`):
For every `.tsx` under `frontend/src/components/recon/` and `frontend/src/pages/recon/`, assert the className strings do NOT contain any banned pattern:
- `hover:-translate-y-`
- `hover:shadow-md`, `hover:shadow-lg`
- `animate-bounce`
- `animate-pulse` (allow only on `Skeleton` components — assert via context)
- `transition-all`
- `duration-300`, `duration-500`
- `rounded-2xl`, `rounded-3xl`
- `rounded-full` on Card/Badge/Button containers (allow on icon-only buttons)
- `bg-gradient-to-`
- `backdrop-blur`
- `scale-105`, `scale-110`
- `ring-2 ring-offset-2`
Implement via static AST parse (use the existing tooling — find via `grep -r 'ts-morph\|@babel/parser' frontend/`).

**Switch styling regression** (`frontend/src/components/recon/__tests__/switch-styling.test.ts`):
For every Switch usage in Recon files, assert `min-h-[44px]` and `min-w-[44px]` are NOT in its className. AST-walk the JSX.

**RTL snapshot tests**:
Each page renders identically (modulo logical-property flipping) in en + ar. Use the project's existing `withRtl` test helper (find via `grep -r 'withRtl\|dir="rtl"' frontend/src/__tests__/`).

**Banned-vocabulary content guard** (`frontend/src/components/recon/__tests__/banned-vocab.test.ts`):
Render each public-facing component (E1, D2, D3, D4, D5, D6) and assert `container.innerHTML` matches none of the banned strings (case-insensitive): Shannon, KeygraphHQ, nmap, subfinder, whatweb, schemathesis, Playwright, Anthropic, Claude.

**URL tab-state regression**:
For every page with tabs (D2 list, D4 detail, D6 settings), assert:
- Tab change updates the URL search param.
- Visiting a URL with `?tab=...` selects the right tab on mount.
- `validateSearch` is exported from the route module.

**Pages-manifest test** (extend the existing one at `frontend/src/__tests__/pages-manifest.ts`):
Add `/recon` and `/recon/:scanId` and `/recon/new` to the manifest; the existing auto-test verifies they're routed.

### 3. Coverage assertion
- `make shell-frontend npm test -- --coverage` reports 100% lines, branches, functions on every file in section 1.
- CI fails if any uncovered line is reported.

### Tests
See sections 1 + 2.

### i18n
- This prompt asserts strings exist via `t(...)` calls (mock i18n returns the key path) — actual translation parity is owned by F6.

### Documentation
- N/A.

### Files to modify
- New cross-cutting test files listed in section 2.
- Per-file tests in `frontend/src/pages/recon/__tests__/` and `frontend/src/components/recon/__tests__/`.
- `frontend/src/__tests__/pages-manifest.ts`.
