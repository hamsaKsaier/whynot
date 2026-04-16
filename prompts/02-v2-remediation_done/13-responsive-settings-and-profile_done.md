# 13 — Responsive: User Settings & Profile Tabs

## Agent
`frontend-developer`

## Skills referenced
- `.claude/agents/design/design-ui-designer.md`
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/url-tab-state.md`
- STYLES.md

## Task

User settings are currently a horizontal tab strip that doesn't fit on mobile. Make every settings tab responsive.

**Routes in scope**:
- `frontend/src/pages/SettingsPage.tsx` (wrapper)
- Tabs: `ProfileTab`, `OrganizationTab`, `ApiKeysTab`, `LanguageTab`, `NotificationsTab`, `AiConfigTab`, `DangerZoneTab`, `UsageTab`, `BillingTab` (billing has its own responsive prompt — see 14, skip here).
- Routes under `frontend/src/routes/_auth/settings/**`.

### Scope / Requirements

1. **Tab navigation**
   - Desktop: horizontal tab strip with URL sync (`validateSearch` from `.claude/rules/url-tab-state.md`).
   - Tablet: horizontal scroll with fade gradient at edges.
   - Mobile: collapse into a `<Select>` dropdown OR a top-level accordion. Prefer dropdown for discoverability.
   - Active tab persists in URL query (`?tab=profile`).

2. **ProfileTab**
   - Avatar upload: drag-and-drop on desktop, tap-to-select on mobile. Show current avatar large on mobile.
   - Name/email fields stacked on mobile, two-column on `sm+`.
   - Save button full-width on mobile, inline on `sm+`.

3. **OrganizationTab**
   - Org name, logo, settings — same layout pattern.
   - Member list: table on desktop, cards on mobile.
   - Invite form: full-width input with button below on mobile.

4. **ApiKeysTab**
   - Create new key: modal dialog, responsive size.
   - Existing keys: table with copy button + revoke; collapse to card stack on mobile.
   - Reveal key once modal: touch-friendly copy button.

5. **LanguageTab**
   - Simple `<Select>` with 5 languages; Save button.
   - Show live preview of current language below.

6. **NotificationsTab**
   - Toggle switches per notification category.
   - Each row: label + description + switch, stacked on mobile, inline on `sm+`.
   - No `min-h-[44px]` on Switch (per `.claude/rules/switch-component-styling.md`) — use parent container.

7. **AiConfigTab**
   - Provider selection (Anthropic / OpenAI / etc).
   - API key input (masked, show/hide toggle).
   - Model dropdown.
   - Validation against the backend AI provider factory.
   - All stacked on mobile.

8. **DangerZoneTab**
   - Destructive actions: delete account, leave org, transfer ownership.
   - Each action in a `border-destructive/50` card.
   - Confirmation dialog with typed confirmation ("DELETE") — mobile-friendly keyboard.

9. **UsageTab**
   - Usage stats: charts responsive, legend below on mobile.
   - Export CSV/JSON button.
   - Date range picker: drops down on desktop, full-screen modal on mobile.

10. **Touch targets, dark mode, RTL, logical properties**.

### Tests (MANDATORY — 100% coverage)
- **Responsive snapshots** at 7 viewport sizes for every tab.
- **Tab URL sync**: e2e asserts `?tab=profile` loads correct tab; refresh preserves; back/forward navigates.
- **Mobile dropdown**: e2e opens the dropdown, selects a tab, asserts correct tab content renders.
- **Form validation**: submit invalid data, assert inline errors in current language.
- **Destructive confirmation**: typed-confirmation blocks submit until exact string entered.
- **RTL**: all tabs render correctly in Arabic.
- **i18n**: all 5 languages, German overflow check.

### i18n (5 languages)
- Keys under `settings.*`, `settings.profile.*`, etc from prompt 01.
- Backend validation errors localized (prompt 06).

### Documentation
- `/docs/en/user-guide/settings/*.md` — one per tab (profile, organization, api-keys, language, notifications, ai-config, danger-zone, usage).
- 5-language variants.

### Constraints
- Docker-only.
- URL tab sync per `.claude/rules/url-tab-state.md`.
- Switch component per `.claude/rules/switch-component-styling.md`.
- Uncodixify compliance.
- Preserve all functionality.

### Verification steps
1. `make shell-client npm run typecheck && npm run lint && npm test`
2. `make shell-client npm run test:responsive -- settings`
3. `make start` → visit each tab at 320px, 768px, 1280px in all 5 languages and both themes.
4. Verify `?tab=...` URL sync works on refresh and back/forward.
