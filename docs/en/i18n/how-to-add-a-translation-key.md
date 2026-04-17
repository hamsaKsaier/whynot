---
title: "How to Add a Translation Key"
description: "This guide walks through the complete workflow for adding a new translatable string to WhyNot QA."
lang: en
draft: false
---

# How to Add a Translation Key

This guide walks through the complete workflow for adding a new translatable string to WhyNot QA.

## 1. Choose the Right Namespace

Each namespace maps to a feature area. Pick the one that fits:

| Namespace | Scope |
|-----------|-------|
| `common` | Auth flows, error boundary, app-wide labels, feature flags |
| `auth` | Two-factor authentication |
| `dashboard` | Projects, environments, monitors, integrations, home page |
| `runner` | Test runner, QA Loop, execution controls, agent activity |
| `results` | Test results, test cases, test runs, artifacts |
| `settings` | Profile, organization, workspace, API keys, notifications, AI providers, usage, danger zone |
| `billing` | Plans, credits, invoices, checkout, PAYG |
| `landing` | Marketing pages (hero, features, pricing, FAQ, footer) |

**Admin-frontend namespaces:** `common`, `admin`, `auth`, `settings`, `superadmin`.

### Namespace Decision Tree

1. Is the string reused across 3+ features? → `common`
2. Is it an auth/login/signup string? → `common` (under `auth.*` prefix)
3. Is it a test runner, QA Loop, or execution string? → `runner`
4. Is it a project, environment, monitor, or integration string? → `dashboard`
5. Is it a test result, test case, or artifact string? → `results`
6. Is it a settings/profile/org/API key string? → `settings`
7. Is it a billing, plan, credit, or checkout string? → `billing`
8. Is it a landing/marketing page string? → `landing`
9. Is it a two-factor auth string? → `auth`

## 2. Name the Key

Keys use **camelCase with dot separators**. Convention:

- **Nouns** for static labels: `settings.profile.name`
- **Verbs** for actions: `settings.profile.save`
- **Adjectives** for states: `runner.status.running`
- Group by feature: `auth.login.title`, `auth.login.emailLabel`, `auth.login.submit`

Examples:
```
dashboard.projects.title        -> "Projects"
dashboard.projects.create       -> "New Project"
dashboard.projects.empty.title  -> "No projects yet"
billing.credits.buy             -> "Buy Credits"
runner.controls.pause           -> "Pause"
```

## 3. Add the English Value

Open the appropriate JSON file under `frontend/public/locales/en/` (or `admin-frontend/public/locales/en/`).

```json
{
  "dashboard.projects.title": "Projects",
  "dashboard.projects.create": "New Project",
  "dashboard.projects.empty.title": "No projects yet"
}
```

Rules:
- Keys sorted alphabetically for diff stability.
- No trailing commas.
- UTF-8 encoding, LF line endings.
- `landing.json` uses nested keys; all other files use flat keys.

## 4. Use the Key in a Component

### Functional components

```tsx
import { useTranslation } from "react-i18next"

export function ProjectsPage() {
  const { t } = useTranslation("dashboard")

  return <h1>{t("dashboard.projects.title")}</h1>
}
```

### Strings with embedded elements (links, bold)

```tsx
import { Trans } from "react-i18next"

<Trans
  i18nKey="auth.signup.acceptTerms"
  ns="common"
  components={{
    termsLink: <a href="/terms" className="text-primary underline" />,
    privacyLink: <a href="/privacy" className="text-primary underline" />,
  }}
/>
```

JSON value: `"I agree to the <termsLink>Terms of Service</termsLink> and <privacyLink>Privacy Policy</privacyLink>"`

### Interpolation

```tsx
t("dashboard.welcome", { name: user.name })
// JSON: "Welcome back, {{name}}"

t("runner.progress", { current: 3, total: 10 })
// JSON: "Step {{current}} of {{total}}"
```

**Placeholder naming rules:**
- Use consistent **camelCase**: `{{userName}}`, not `{{user_name}}`
- Keep names short but descriptive: `{{count}}`, `{{name}}`, `{{error}}`
- Use the same placeholder name across all languages for the same variable
- Every language file must contain the exact same `{{placeholders}}` as English

### Plurals

i18next supports plural forms via `{{count}}`. For languages with complex plural rules (like Arabic), use `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` suffixes:

```json
// en/common.json
{
  "common.items": "{{count}} item",
  "common.items_plural": "{{count}} items"
}

// ar/common.json (Arabic has 6 plural forms)
{
  "common.items_zero": "لا عناصر",
  "common.items_one": "عنصر واحد",
  "common.items_two": "عنصران",
  "common.items_few": "{{count}} عناصر",
  "common.items_many": "{{count}} عنصرًا",
  "common.items_other": "{{count}} عنصر"
}
```

Usage in components:
```tsx
t("common.items", { count: items.length })
```

### Zod validation messages

Create schemas inside the component or use a factory function:

```tsx
function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.common.emailValidation")),
    password: z.string().min(8, t("auth.common.passwordMinLength")),
  })
}

export function LoginPage() {
  const { t } = useTranslation("common")
  const loginSchema = createLoginSchema(t)
  // ...
}
```

### Toast / notification messages

Always call `t()` at call time, not at module load:

```tsx
// Correct
toast.success(t("dashboard.projects.createSuccess"))

// Wrong - t() called at module load, won't update on language change
const MSG = t("dashboard.projects.createSuccess")
toast.success(MSG)
```

### Class components (ErrorBoundary)

Use `withTranslation` HOC:

```tsx
import { withTranslation, WithTranslation } from "react-i18next"

class ErrorBoundaryInner extends React.Component<Props & WithTranslation> {
  render() {
    const { t } = this.props
    return <h1>{t("error.boundary.title")}</h1>
  }
}

export const ErrorBoundary = withTranslation("common")(ErrorBoundaryInner)
```

## 5. Add Stubs for Other Languages

After adding English keys, sync the key tree to other languages:

```bash
node scripts/sync-locale-stubs.js
```

This adds empty string values for any new keys in `ar`, `fr`, `de`, `es` files.

## 6. Run Validation

```bash
# Type checking
make shell-client npm run typecheck

# Linting  
make shell-client npm run lint

# i18n tests
make test-frontend

# RTL layout validation
make rtl-check
```

The `i18n-completeness` test checks:
- All 5 languages have the same namespace files.
- All namespaces have identical key trees across languages.
- All English values are non-empty.
- Translated values (when present) differ from English.

The `i18n-no-hardcoded-strings` test scans **all** component and page files (`src/**/*.{ts,tsx}`) for English string literals that should use `t()`. It checks:
- JSX text content (e.g., `>Some text<`)
- Text-bearing props: `title`, `placeholder`, `aria-label`, `alt`
- Toast messages: `toast.error("...")`, `toast.success("...")`
- Zod validation messages: `.min(3, "Must be...")`

New PRs **must** keep both `i18n-completeness` and `i18n-no-hardcoded-strings` tests green.

## Backend Localization

The gateway API is also localized. See the [i18n overview](./index.md#backend-localization) for full details. The key points for adding backend translation keys:

### The `Accept-Language` Contract

All API responses honor the `Accept-Language` header. Supported: `en`, `ar`, `fr`, `de`, `es`. Falls back to `en` if unrecognized.

### How `req.t()` Works

The i18n middleware at `gateway/src/middleware/i18n.ts` parses `Accept-Language` and attaches `req.t()`. Usage:

```typescript
req.t('errors:auth.unauthorized')
req.t('success:admin.planUpdated', { planName })
```

### Where Backend Translations Live

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

### Adding a New Backend Key (Step by Step)

1. Add the key to `en/{namespace}.json`.
2. Add translations to `ar`, `fr`, `de`, `es` files for the same namespace.
3. Use `req.t('namespace:key')` in the handler.
4. For utility functions without `req`, use `createError(msg, code, status, details, 'errors:key')`.
5. Run `i18n-backend-completeness.test.ts` to verify all languages have the key.

### Email Template Localization

Uses `i18n.getFixedT(recipientLocale, 'emails')`. The locale comes from the user record, not the request header.

### Error Response Shape

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<localized>"
  }
}
```

or:

```json
{
  "success": false,
  "error": "<localized>"
}
```

## Checklist

Before submitting a PR with new translation keys:

- [ ] Key added to the correct namespace JSON file
- [ ] English value is non-empty and descriptive
- [ ] Component uses `useTranslation()` hook with correct namespace
- [ ] All user-facing strings use `t()` (labels, placeholders, titles, aria-labels, validation messages, toasts)
- [ ] Interpolation uses `{{variable}}` syntax
- [ ] Embedded elements use `<Trans>` component
- [ ] Locale stubs synced for other languages
- [ ] `i18n-completeness` test passes
- [ ] `i18n-no-hardcoded-strings` test passes
