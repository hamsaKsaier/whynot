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
make shell-client npm test -- i18n
```

The `i18n-completeness` test checks:
- All 5 languages have the same namespace files.
- All namespaces have identical key trees across languages.
- All English values are non-empty.
- Translated values (when present) differ from English.

The `i18n-no-hardcoded-strings` test scans page files for English string literals that should use `t()`.

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
