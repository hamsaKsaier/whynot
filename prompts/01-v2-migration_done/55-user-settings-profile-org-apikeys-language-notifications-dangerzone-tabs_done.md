# User Settings: Profile, Organization, API Keys, Language, Notifications, Danger Zone tabs

## Agent
`design-ui-designer` (lead) + `api-designer` + skill `audit-logging` + skill `shadcn-design-system-compliance`

## Depends on
`54-validate-landing-seo-and-lighthouse.md`

## Goal
Build the remaining Settings tabs (AI tab from prompt 29 and Billing tab from prompt 39 already exist). Adds Profile, Organization, API Keys (hashed at rest, shown once), Language, Notifications, and Danger Zone (export + delete account).

## Single source of truth
`ARCHITECTURE.md` sections 7, 13.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (any new column/table requires user coordination)

## Task

### 1. SettingsPage tab host
- Extend `frontend/src/pages/SettingsPage.tsx` to render all tabs in a Shadcn `Tabs` layout: Profile, Organization, AI, API Keys, Language, Notifications, Billing, Danger Zone.
- Each tab is a route segment (`/settings/profile`, etc.) for deep-linking.

### 2. ProfileTab
- `frontend/src/pages/settings/tabs/ProfileTab.tsx` — name, email, avatar upload (if avatar feature exists; else just name + email), password change (re-auth required).
- Backend: `PATCH /api/me/profile`, `POST /api/me/password`.

### 3. OrganizationTab
- `frontend/src/pages/settings/tabs/OrganizationTab.tsx` — org name, members list (with role), invite by email (existing email subsystem), remove member, transfer ownership.
- Backend endpoints (org-scoped): `GET/PATCH /api/me/organization`, `GET /api/me/organization/members`, `POST /api/me/organization/invitations`, etc.

### 4. ApiKeysTab
- `frontend/src/pages/settings/tabs/ApiKeysTab.tsx` — list keys (showing last 4 + label + created_at + last_used_at), create (shows full key ONCE in a dialog), rotate, revoke.
- Coordinate with user on a migration if `api_keys` table doesn't already exist with the right shape.
- Keys hashed at rest (sha256 + per-key salt). Plaintext never persisted, never logged, never returned after creation.

### 5. LanguageTab
- `frontend/src/pages/settings/tabs/LanguageTab.tsx` — preferred language picker; persists to `users.preferred_language` (coordinate migration if column missing) and immediately sets `i18next` language.

### 6. NotificationsTab
- `frontend/src/pages/settings/tabs/NotificationsTab.tsx` — toggle email notification categories (product updates, billing, security). Persists to a `user_notification_preferences` table (coordinate migration if needed).

### 7. DangerZoneTab
- `frontend/src/pages/settings/tabs/DangerZoneTab.tsx` — "Export my data" (CSV/JSON download), "Delete account" (re-auth required, 7-day soft-delete grace period).
- Backend: `POST /api/me/export` → returns a download URL after async generation; `POST /api/me/delete` → soft-delete with grace period.

### 8. i18n
- All UI strings via `t('settings:*')`. 5 languages.

### Files to create/modify
- `frontend/src/pages/SettingsPage.tsx` — extended
- `frontend/src/pages/settings/tabs/{ProfileTab,OrganizationTab,ApiKeysTab,LanguageTab,NotificationsTab,DangerZoneTab}.tsx` — new
- Backend: `gateway/src/api/me/profile.ts`, `password.ts`, `organization.ts`, `api-keys.ts`, `notifications.ts`, `language.ts`, `delete.ts`, `export.ts` — new (or extended if existing)
- `services/database/migrations/0NN_user_settings_columns.sql` — new (user-coordinated, only if columns/tables missing)
- `frontend/public/locales/{en,ar,fr,de,es}/settings.json` — extend

### Tests
- Unit: API key hashing/verification; key never returned after creation.
- Supertest: every endpoint, including auth + cross-user/cross-org denial.
- Vitest component tests for each tab.
- Playwright: each tab reachable via deep-link, edits persist, toasts localized, dark + RTL clean.
- Security: API key plaintext present in NO log, NO audit row, NO GET response.
- Coverage: 100% on touched files.

### i18n
- All localized.

### Documentation
- `docs/{en,ar,fr,de,es}/settings/overview.md`

### Acceptance criteria
- [ ] All 6 new tabs functional + accessible.
- [ ] API keys hashed at rest, shown once.
- [ ] Org-scoped reads enforced.
- [ ] Localized in 5 languages.
- [ ] Account deletion soft-deletes + has grace period.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
