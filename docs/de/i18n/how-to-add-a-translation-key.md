---
title: "So fuegen Sie einen Uebersetzungsschluessel hinzu"
description: "Vollstaendiger Workflow zum Hinzufuegen einer neuen uebersetzbaren Zeichenkette in WhyNot QA."
lang: de
draft: false
---

# So fügen Sie einen Übersetzungsschlüssel hinzu

Diese Anleitung beschreibt den vollständigen Workflow zum Hinzufügen einer neuen übersetzbaren Zeichenkette in WhyNot QA.

## 1. Den richtigen Namespace wählen

Jeder Namespace entspricht einem Funktionsbereich. Wählen Sie den passenden:

| Namespace | Geltungsbereich |
|-----------|----------------|
| `common` | Authentifizierungsflüsse, Fehlergrenzen, App-weite Labels, Feature Flags |
| `auth` | Zwei-Faktor-Authentifizierung |
| `dashboard` | Projekte, Umgebungen, Monitore, Integrationen, Startseite |
| `runner` | Testausführer, QA Loop, Ausführungssteuerung, Agentenaktivität |
| `results` | Testergebnisse, Testfälle, Testläufe, Artefakte |
| `settings` | Profil, Organisation, Workspace, API-Schlüssel, Benachrichtigungen, KI-Anbieter, Nutzung, Gefahrenzone |
| `billing` | Pläne, Guthaben, Rechnungen, Checkout, PAYG |
| `landing` | Marketingseiten (Hero, Funktionen, Preise, FAQ, Footer) |

**Admin-Frontend-Namespaces:** `common`, `admin`, `auth`, `settings`, `superadmin`.

### Namespace-Entscheidungsbaum

1. Wird die Zeichenkette in 3+ Funktionen verwendet? → `common`
2. Ist es eine Auth/Login/Registrierungs-Zeichenkette? → `common` (unter dem Präfix `auth.*`)
3. Ist es eine Testausführer-, QA-Loop- oder Ausführungs-Zeichenkette? → `runner`
4. Ist es eine Projekt-, Umgebungs-, Monitor- oder Integrations-Zeichenkette? → `dashboard`
5. Ist es eine Testergebnis-, Testfall- oder Artefakt-Zeichenkette? → `results`
6. Ist es eine Einstellungs-/Profil-/Organisations-/API-Schlüssel-Zeichenkette? → `settings`
7. Ist es eine Abrechnungs-, Plan-, Guthaben- oder Checkout-Zeichenkette? → `billing`
8. Ist es eine Landing-/Marketingseiten-Zeichenkette? → `landing`
9. Ist es eine Zwei-Faktor-Authentifizierungs-Zeichenkette? → `auth`

## 2. Den Schlüssel benennen

Schlüssel verwenden **camelCase mit Punkt-Trennzeichen**. Konvention:

- **Substantive** für statische Labels: `settings.profile.name`
- **Verben** für Aktionen: `settings.profile.save`
- **Adjektive** für Zustände: `runner.status.running`
- Gruppierung nach Funktion: `auth.login.title`, `auth.login.emailLabel`, `auth.login.submit`

Beispiele:
```
dashboard.projects.title        -> "Projects"
dashboard.projects.create       -> "New Project"
dashboard.projects.empty.title  -> "No projects yet"
billing.credits.buy             -> "Buy Credits"
runner.controls.pause           -> "Pause"
```

## 3. Den englischen Wert hinzufügen

Öffnen Sie die entsprechende JSON-Datei unter `frontend/public/locales/en/` (oder `admin-frontend/public/locales/en/`).

```json
{
  "dashboard.projects.title": "Projects",
  "dashboard.projects.create": "New Project",
  "dashboard.projects.empty.title": "No projects yet"
}
```

Regeln:
- Schlüssel alphabetisch sortiert für Diff-Stabilität.
- Keine nachgestellten Kommas.
- UTF-8-Kodierung, LF-Zeilenenden.
- `landing.json` verwendet verschachtelte Schlüssel; alle anderen Dateien verwenden flache Schlüssel.

## 4. Den Schlüssel in einer Komponente verwenden

### Funktionale Komponenten

```tsx
import { useTranslation } from "react-i18next"

export function ProjectsPage() {
  const { t } = useTranslation("dashboard")

  return <h1>{t("dashboard.projects.title")}</h1>
}
```

### Zeichenketten mit eingebetteten Elementen (Links, Fettdruck)

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

JSON-Wert: `"Ich stimme den <termsLink>Nutzungsbedingungen</termsLink> und der <privacyLink>Datenschutzrichtlinie</privacyLink> zu"`

### Interpolation

```tsx
t("dashboard.welcome", { name: user.name })
// JSON: "Willkommen zurück, {{name}}"

t("runner.progress", { current: 3, total: 10 })
// JSON: "Schritt {{current}} von {{total}}"
```

**Regeln zur Benennung von Platzhaltern:**
- Verwenden Sie konsistent **camelCase**: `{{userName}}`, nicht `{{user_name}}`
- Halten Sie die Namen kurz, aber aussagekräftig: `{{count}}`, `{{name}}`, `{{error}}`
- Verwenden Sie denselben Platzhalternamen in allen Sprachen für dieselbe Variable
- Jede Sprachdatei muss exakt dieselben `{{Platzhalter}}` wie Englisch enthalten

### Pluralformen

i18next unterstützt Pluralformen über `{{count}}`. Für Sprachen mit komplexen Pluralregeln (wie Arabisch) verwenden Sie die Suffixe `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`:

```json
// en/common.json
{
  "common.items": "{{count}} item",
  "common.items_plural": "{{count}} items"
}

// ar/common.json (Arabisch hat 6 Pluralformen)
{
  "common.items_zero": "لا عناصر",
  "common.items_one": "عنصر واحد",
  "common.items_two": "عنصران",
  "common.items_few": "{{count}} عناصر",
  "common.items_many": "{{count}} عنصرًا",
  "common.items_other": "{{count}} عنصر"
}
```

Verwendung in Komponenten:
```tsx
t("common.items", { count: items.length })
```

### Zod-Validierungsmeldungen

Erstellen Sie Schemas innerhalb der Komponente oder verwenden Sie eine Factory-Funktion:

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

### Toast- / Benachrichtigungsmeldungen

Rufen Sie `t()` immer zum Aufrufzeitpunkt auf, nicht beim Laden des Moduls:

```tsx
// Richtig
toast.success(t("dashboard.projects.createSuccess"))

// Falsch - t() wird beim Laden des Moduls aufgerufen, aktualisiert sich nicht bei Sprachwechsel
const MSG = t("dashboard.projects.createSuccess")
toast.success(MSG)
```

### Klassenkomponenten (ErrorBoundary)

Verwenden Sie das `withTranslation`-HOC:

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

## 5. Stubs für andere Sprachen hinzufügen

Nach dem Hinzufügen englischer Schlüssel synchronisieren Sie den Schlüsselbaum mit den anderen Sprachen:

```bash
node scripts/sync-locale-stubs.js
```

Dies fügt leere Zeichenkettenwerte für alle neuen Schlüssel in den Dateien `ar`, `fr`, `de`, `es` hinzu.

## 6. Validierung ausführen

```bash
# Typüberprüfung
make shell-client npm run typecheck

# Linting
make shell-client npm run lint

# i18n-Tests
make test-frontend

# RTL-Layout-Validierung
make rtl-check
```

Der `i18n-completeness`-Test prüft:
- Alle 5 Sprachen haben dieselben Namespace-Dateien.
- Alle Namespaces haben identische Schlüsselbäume über alle Sprachen hinweg.
- Alle englischen Werte sind nicht leer.
- Übersetzte Werte (falls vorhanden) unterscheiden sich vom Englischen.

Der `i18n-no-hardcoded-strings`-Test scannt **alle** Komponenten- und Seitendateien (`src/**/*.{ts,tsx}`) nach englischen Zeichenkettenliteralen, die `t()` verwenden sollten. Er prüft:
- JSX-Textinhalte (z. B. `>Irgendein Text<`)
- Texttragende Props: `title`, `placeholder`, `aria-label`, `alt`
- Toast-Meldungen: `toast.error("...")`, `toast.success("...")`
- Zod-Validierungsmeldungen: `.min(3, "Muss sein...")`

Neue PRs **müssen** die Tests `i18n-completeness` und `i18n-no-hardcoded-strings` grün halten.

## Backend-Lokalisierung

Die Gateway-API ist ebenfalls lokalisiert. Siehe die [i18n-Ubersicht](./index.md#backend-lokalisierung) fur alle Details. Die wichtigsten Punkte zum Hinzufugen von Backend-Ubersetzungsschlusseln:

### Der `Accept-Language`-Vertrag

Alle API-Antworten berucksichtigen den `Accept-Language`-Header. Unterstutzt: `en`, `ar`, `fr`, `de`, `es`. Fallt auf `en` zuruck, wenn der Wert nicht erkannt wird.

### Wie `req.t()` funktioniert

Die i18n-Middleware unter `gateway/src/middleware/i18n.ts` analysiert `Accept-Language` und hangt `req.t()` an. Verwendung:

```typescript
req.t('errors:auth.unauthorized')
req.t('success:admin.planUpdated', { planName })
```

### Wo die Backend-Ubersetzungen liegen

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

### Einen neuen Backend-Schlussel hinzufugen (Schritt fur Schritt)

1. Fugen Sie den Schlussel zu `en/{namespace}.json` hinzu.
2. Fugen Sie Ubersetzungen zu den Dateien `ar`, `fr`, `de`, `es` fur denselben Namespace hinzu.
3. Verwenden Sie `req.t('namespace:key')` im Handler.
4. Fur Hilfsfunktionen ohne `req` verwenden Sie `createError(msg, code, status, details, 'errors:key')`.
5. Fuhren Sie `i18n-backend-completeness.test.ts` aus, um zu uberprufen, dass alle Sprachen den Schlussel haben.

### E-Mail-Vorlagen-Lokalisierung

Verwendet `i18n.getFixedT(recipientLocale, 'emails')`. Der Locale stammt aus dem Benutzerdatensatz, nicht aus dem Request-Header.

### Fehlerantwort-Format

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<lokalisierter Text>"
  }
}
```

oder:

```json
{
  "success": false,
  "error": "<lokalisierter Text>"
}
```

## Checkliste

Vor dem Einreichen eines PRs mit neuen Übersetzungsschlüsseln:

- [ ] Schlüssel zur richtigen Namespace-JSON-Datei hinzugefügt
- [ ] Englischer Wert ist nicht leer und aussagekräftig
- [ ] Komponente verwendet den `useTranslation()`-Hook mit dem richtigen Namespace
- [ ] Alle benutzersichtbaren Zeichenketten verwenden `t()` (Labels, Platzhalter, Titel, aria-labels, Validierungsmeldungen, Toasts)
- [ ] Interpolation verwendet die `{{variable}}`-Syntax
- [ ] Eingebettete Elemente verwenden die `<Trans>`-Komponente
- [ ] Sprach-Stubs für andere Sprachen synchronisiert
- [ ] `i18n-completeness`-Test besteht
- [ ] `i18n-no-hardcoded-strings`-Test besteht
