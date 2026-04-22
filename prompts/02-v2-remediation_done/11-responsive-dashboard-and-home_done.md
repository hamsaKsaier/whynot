# 11 — Responsive: Dashboard, Home, Projects, Environments, Architecture Flow

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/skills/shadcn-design-system-compliance/`
- `.claude/rules/uncodixify-ui.md`
- STYLES.md

## Task

Make the main dashboard surface responsive across all screen sizes.

**Routes in scope**:
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/DashboardPage.tsx` (or whatever the primary post-login route is)
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/EnvironmentsPage.tsx`
- `frontend/src/pages/ArchitectureFlowPage.tsx` (ReactFlow canvas — special handling)
- Any shared dashboard layout/shell (`frontend/src/components/layout/DashboardShell.tsx` or equivalent)
- Sidebar navigation / top nav

### Scope / Requirements

1. **Dashboard shell**
   - Sidebar collapses to a drawer on mobile (`<Sheet>` from shadcn).
   - Top nav with hamburger trigger on mobile; full horizontal nav on `lg+`.
   - Main content area: `max-w-7xl mx-auto p-4 sm:p-6 lg:p-8`.
   - User menu and notifications bell accessible from mobile header.

2. **HomePage**
   - Hero section: stacked on mobile, side-by-side on `lg+`.
   - Stat cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
   - Recent activity list: cards on mobile, table row on `md+`.
   - CTA buttons: full-width on mobile, inline on `sm+`.
   - Remove gradient hero and `text-white` (coordinate with prompt 07).

3. **ProjectsPage**
   - Project grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
   - Filters/search bar stacks on mobile.
   - Create button becomes a floating action button (FAB) or prominent top-right button on mobile.

4. **EnvironmentsPage**
   - Same grid pattern as projects.
   - Environment cards show key info inline on desktop, stacked on mobile.

5. **ArchitectureFlowPage (ReactFlow)**
   - ReactFlow canvas is inherently non-responsive. Add:
     - Full-screen mode on mobile (`h-screen` with fixed header).
     - Pinch-zoom support (ReactFlow supports this natively — verify it's enabled).
     - Mini-map hidden on mobile, visible on `md+`.
     - Node controls panel collapses to a bottom sheet on mobile.
     - Fallback: on viewport < 640px, show a warning banner "Best viewed on tablet or desktop" with a button to open a read-only list view.

6. **Responsive breakpoints**
   - `sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px.
   - Tailwind defaults — do not customize.

7. **Touch targets**: ≥44x44px via parent containers.

8. **RTL + dark mode**: logical properties, semantic tokens.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots**: Playwright captures each route at 7 viewport sizes (320, 375, 414, 768, 1024, 1280, 1920). Visual regression.
- **No horizontal scroll**: asserted at every viewport.
- **Sidebar drawer**: e2e test opens/closes the drawer on mobile.
- **Grid responsiveness**: assert CSS grid column count changes at each breakpoint.
- **Pinch-zoom**: mobile e2e simulates pinch gesture on ReactFlow canvas.
- **i18n**: every page in all 5 languages, German strings don't overflow.
- **Dark mode parity**.
- **RTL parity**.

### i18n (5 languages)
- Reuse `dashboard.*`, `common.*`, `projects.*`, `environments.*` keys from prompt 01.
- Test at 320px that German labels wrap gracefully.

### Documentation
- `/docs/en/user-guide/dashboard/overview.md`, `projects.md`, `environments.md`.
- 5-language variants.

### Constraints
- Docker-only: `make shell-client`.
- Preserve STYLES.md rules and uncodixify compliance (no hover shadows, no gradients, etc).
- No new dependencies.
- Existing functionality preserved.

### Verification steps
1. `make shell-client npm run typecheck && npm run lint && npm test`
2. `make shell-client npm run test:responsive -- home dashboard projects environments architecture-flow`
3. `make start` → manual smoke at 320px, 768px, 1280px in all 5 languages and both themes.
