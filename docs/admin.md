# Admin Frontend — Operator Runbook

## Overview

The admin frontend is a React SPA at `admin-frontend/` that provides superadmin operators with management tools for users, plans, subscriptions, credits, announcements, audit logs, analytics, and system settings.

## Access

- **URL**: `http://localhost:5184` (dev), configured in `admin-frontend/vite.config.ts`
- **Auth**: Email/password login. Only users with `admin` or `super_admin` role can access.
- **Token**: Stored in `localStorage` as `admin_auth_token` (Bearer JWT).

## Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | KPI cards (MRR, ARR, users, plans), recent signups, plan distribution |
| `/users` | Users | Paginated user list with search, role filter, bulk export |
| `/users/:id` | User Detail | Profile, role change, credit grant/revoke, ban/unban, impersonate |
| `/plans` | Plans | Plan cards with archive/restore, Stripe sync, feature flags |
| `/plans/new` | Plan Create | Form for new plan with dollar-to-cents conversion |
| `/plans/:id/edit` | Plan Edit | Edit existing plan |
| `/subscriptions` | Subscriptions | Paginated table with status filter |
| `/credits` | Credits | Credit ledger with manual grant dialog |
| `/analytics` | Analytics | Charts: signups, revenue by plan, credit usage, churn |
| `/audit-log` | Audit Log | Filterable audit trail with expandable details |
| `/announcements` | Announcements | CRUD for system announcements with scheduling |
| `/settings` | System Settings | Tabbed key-value config (General, Credits, Email, Webhooks, Security) |

## Data Contracts

- **Money**: All monetary values stored as bigint cents. Displayed via `formatCents()` from `lib/money.ts`.
- **Timestamps**: ISO 8601 UTC. Rendered via `Intl.DateTimeFormat`.
- **Pagination**: Cursor-based in UI (ready for backend migration). Currently wraps offset pagination.
- **API Format**: camelCase JSON. API base: `/api` proxied to gateway at `localhost:3010`.

## Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| AdminPageHeader | `components/admin/AdminPageHeader.tsx` | Title + breadcrumbs + action slot |
| FilterBar | `components/admin/FilterBar.tsx` | Search + select filters + active chips |
| PaginatedTable | `components/admin/PaginatedTable.tsx` | Shadcn Table + cursor pagination + selection |
| BulkActions | `components/admin/BulkActions.tsx` | Selection count + action dropdown |
| StatusBadge | `components/admin/StatusBadge.tsx` | Color-coded status badges |
| DateRangePicker | `components/admin/DateRangePicker.tsx` | Date range with presets |
| ConfirmDialog | `components/admin/ConfirmDialog.tsx` | Destructive action confirmation |
| ExportMenu | `components/admin/ExportMenu.tsx` | CSV/JSON export dropdown |

## Running

```bash
# Development
docker compose exec admin-frontend npm run dev

# Build
docker compose exec admin-frontend npm run build

# Tests
docker compose exec admin-frontend npx vitest run
docker compose exec admin-frontend npx playwright test
```

## Detailed runbook

See prompt 46 for the full operator runbook with incident response procedures.
