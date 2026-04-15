# Cómo agregar una clave de traducción

Esta guía describe el flujo completo para agregar una nueva cadena traducible a WhyNot QA.

## 1. Elija el namespace correcto

Cada namespace corresponde a un área funcional. Elija el que corresponda:

| Namespace | Alcance |
|-----------|---------|
| `common` | Flujos de autenticación, límite de errores, etiquetas globales, feature flags |
| `auth` | Autenticación de dos factores |
| `dashboard` | Proyectos, entornos, monitores, integraciones, página de inicio |
| `runner` | Ejecutor de pruebas, QA Loop, controles de ejecución, actividad del agente |
| `results` | Resultados de pruebas, casos de prueba, ejecuciones, artefactos |
| `settings` | Perfil, organización, espacio de trabajo, claves de API, notificaciones, proveedores de IA, uso, zona de peligro |
| `billing` | Planes, créditos, facturas, checkout, PAYG |
| `landing` | Páginas de marketing (hero, funcionalidades, precios, FAQ, footer) |

**Namespaces del admin-frontend:** `common`, `admin`, `auth`, `settings`, `superadmin`.

## 2. Nombre de la clave

Las claves usan **camelCase con separadores de punto**. Convención:

- **Sustantivos** para etiquetas estáticas: `settings.profile.name`
- **Verbos** para acciones: `settings.profile.save`
- **Adjetivos** para estados: `runner.status.running`
- Agrupe por funcionalidad: `auth.login.title`, `auth.login.emailLabel`, `auth.login.submit`

Ejemplos:
```
dashboard.projects.title        -> "Projects"
dashboard.projects.create       -> "New Project"
dashboard.projects.empty.title  -> "No projects yet"
billing.credits.buy             -> "Buy Credits"
runner.controls.pause           -> "Pause"
```

## 3. Agregue el valor en inglés

Abra el archivo JSON correspondiente en `frontend/public/locales/en/` (o `admin-frontend/public/locales/en/`).

```json
{
  "dashboard.projects.title": "Projects",
  "dashboard.projects.create": "New Project",
  "dashboard.projects.empty.title": "No projects yet"
}
```

Reglas:
- Claves ordenadas alfabéticamente para estabilidad en diffs.
- Sin comas finales.
- Codificación UTF-8, fin de línea LF.
- `landing.json` usa claves anidadas; todos los demás archivos usan claves planas.

## 4. Use la clave en un componente

### Componentes funcionales

```tsx
import { useTranslation } from "react-i18next"

export function ProjectsPage() {
  const { t } = useTranslation("dashboard")

  return <h1>{t("dashboard.projects.title")}</h1>
}
```

### Cadenas con elementos embebidos (enlaces, negritas)

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

Valor JSON: `"Acepto los <termsLink>Términos de servicio</termsLink> y la <privacyLink>Política de privacidad</privacyLink>"`

### Interpolación

```tsx
t("dashboard.welcome", { name: user.name })
// JSON: "Bienvenido de nuevo, {{name}}"

t("runner.progress", { current: 3, total: 10 })
// JSON: "Paso {{current}} de {{total}}"
```

### Mensajes de validación con Zod

Cree los esquemas dentro del componente o use una función fábrica:

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

### Mensajes de toast / notificaciones

Siempre llame a `t()` en el momento de la ejecución, no al cargar el módulo:

```tsx
// Correcto
toast.success(t("dashboard.projects.createSuccess"))

// Incorrecto - t() se llama al cargar el módulo, no se actualiza al cambiar el idioma
const MSG = t("dashboard.projects.createSuccess")
toast.success(MSG)
```

### Componentes de clase (ErrorBoundary)

Use el HOC `withTranslation`:

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

## 5. Agregue stubs para otros idiomas

Después de agregar las claves en inglés, sincronice el árbol de claves con los otros idiomas:

```bash
node scripts/sync-locale-stubs.js
```

Esto agrega valores de cadena vacíos para cualquier clave nueva en los archivos `ar`, `fr`, `de`, `es`.

## 6. Ejecute la validación

```bash
# Verificación de tipos
make shell-client npm run typecheck

# Linting
make shell-client npm run lint

# Pruebas de i18n
make shell-client npm test -- i18n
```

La prueba `i18n-completeness` verifica:
- Los 5 idiomas tienen los mismos archivos de namespace.
- Todos los namespaces tienen árboles de claves idénticos en todos los idiomas.
- Todos los valores en inglés son no vacíos.
- Los valores traducidos (cuando están presentes) difieren del inglés.

La prueba `i18n-no-hardcoded-strings` escanea los archivos de página buscando literales de cadena en inglés que deberían usar `t()`.

## Lista de verificación

Antes de enviar un PR con nuevas claves de traducción:

- [ ] Clave agregada al archivo JSON del namespace correcto
- [ ] El valor en inglés es no vacío y descriptivo
- [ ] El componente usa el hook `useTranslation()` con el namespace correcto
- [ ] Todas las cadenas visibles al usuario usan `t()` (etiquetas, placeholders, títulos, aria-labels, mensajes de validación, toasts)
- [ ] La interpolación usa la sintaxis `{{variable}}`
- [ ] Los elementos embebidos usan el componente `<Trans>`
- [ ] Los stubs de idiomas están sincronizados
- [ ] La prueba `i18n-completeness` pasa
- [ ] La prueba `i18n-no-hardcoded-strings` pasa
