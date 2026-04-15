# 16 — Responsive: Admin Frontend (Non-Superadmin)

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/url-tab-state.md`
- STYLES.md

## Task

Make the admin frontend responsive. This prompt covers the **non-superadmin** admin routes — login, dashboard, shared shell, error pages. Superadmin pages are covered in prompt 17.

**Routes in scope**:
- `admin-frontend/src/pages/LoginPage.tsx`
- `admin-frontend/src/pages/DashboardPage.tsx`
- `admin-frontend/src/components/layout/AdminShell.tsx` (sidebar + top nav)
- Error pages (404, 500, forbidden)
- Any shared admin primitives

### Scope / Requirements

1. **AdminShell**
   - Sidebar: collapses to drawer on mobile (shadcn `Sheet`).
   - Top bar: logo + hamburger on mobile; full breadcrumbs on desktop.
   - User menu accessible from mobile header.
   - Sidebar uses STYLES.md sidebar tokens.

2. **LoginPage**
   - Same pattern as prompt 10's auth pages but scoped to admin login.
   - Extra: show "Superadmin only" notice if failing due to role (localized).

3. **DashboardPage**
   - Stat cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
   - Recent activity feed: table on desktop, cards on mobile.
   - Quick actions bar: sticky on mobile.

4. **Error pages**
   - Centered content, responsive padding, CTA to return home.

5. **Touch targets, dark mode, RTL, logical properties, uncodixify compliance**.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots** at 7 viewports.
- **Drawer toggle**: e2e.
- **Login flow**: e2e at mobile viewport.
- **Role gating**: assert non-superadmin redirects to login.
- **i18n**: 5 languages, German overflow.
- **a11y/contrast**: light + dark.

### i18n (5 languages)
- Keys under `admin.*`, `auth.*` from prompt 01 (admin namespace).

### Documentation
- `/docs/en/admin/shell-and-navigation.md`, `/docs/en/admin/dashboard.md`.
- 5-language variants.

### Constraints
- Docker-only: `make shell-admin`.
- Uncodixify compliance.
- Preserve functionality.

### Verification steps
1. `make shell-admin npm run typecheck && npm run lint && npm test`
2. `make shell-admin npm run test:responsive`
3. `make start` → `http://localhost:5184`, sign in as superadmin, visit dashboard at 320/768/1280.
