---
title: "Como agregar una clave de traduccion"
description: "Guia completa del flujo de trabajo para agregar una nueva cadena traducible a WhyNot QA."
lang: es
draft: false
---

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

### Árbol de decisión del namespace

1. ¿Se usa la cadena en 3+ funcionalidades? → `common`
2. ¿Es una cadena de auth/login/registro? → `common` (bajo el prefijo `auth.*`)
3. ¿Es una cadena del runner de pruebas, QA Loop o ejecución? → `runner`
4. ¿Es una cadena de proyecto, entorno, monitor o integración? → `dashboard`
5. ¿Es una cadena de resultado de prueba, caso de prueba o artefacto? → `results`
6. ¿Es una cadena de configuración/perfil/organización/clave de API? → `settings`
7. ¿Es una cadena de facturación, plan, crédito o checkout? → `billing`
8. ¿Es una cadena de página de destino/marketing? → `landing`
9. ¿Es una cadena de autenticación de dos factores? → `auth`

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

**Reglas de nomenclatura de placeholders:**
- Use **camelCase** de forma consistente: `{{userName}}`, no `{{user_name}}`
- Mantenga los nombres cortos pero descriptivos: `{{count}}`, `{{name}}`, `{{error}}`
- Use el mismo nombre de placeholder en todos los idiomas para la misma variable
- Cada archivo de idioma debe contener exactamente los mismos `{{placeholders}}` que el inglés

### Plurales

i18next soporta formas plurales mediante `{{count}}`. Para idiomas con reglas de plural complejas (como el árabe con sus 6 formas), use los sufijos `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`:

```json
// en/common.json
{
  "common.items": "{{count}} item",
  "common.items_plural": "{{count}} items"
}

// ar/common.json (el árabe tiene 6 formas de plural)
{
  "common.items_zero": "لا عناصر",
  "common.items_one": "عنصر واحد",
  "common.items_two": "عنصران",
  "common.items_few": "{{count}} عناصر",
  "common.items_many": "{{count}} عنصرًا",
  "common.items_other": "{{count}} عنصر"
}
```

Uso en componentes:
```tsx
t("common.items", { count: items.length })
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
make test-frontend

# Validación del diseño RTL
make rtl-check
```

La prueba `i18n-completeness` verifica:
- Los 5 idiomas tienen los mismos archivos de namespace.
- Todos los namespaces tienen árboles de claves idénticos en todos los idiomas.
- Todos los valores en inglés son no vacíos.
- Los valores traducidos (cuando están presentes) difieren del inglés.

La prueba `i18n-no-hardcoded-strings` escanea **todos** los archivos de componentes y páginas (`src/**/*.{ts,tsx}`) buscando literales de cadena en inglés que deberían usar `t()`. Verifica:
- Contenido de texto JSX (ej. `>Algún texto<`)
- Props con texto: `title`, `placeholder`, `aria-label`, `alt`
- Mensajes toast: `toast.error("...")`, `toast.success("...")`
- Mensajes de validación Zod: `.min(3, "Debe ser...")`

Los nuevos PRs **deben** mantener las pruebas `i18n-completeness` e `i18n-no-hardcoded-strings` en verde.

## Localizacion del backend

La API del gateway esta completamente localizada. Todas las respuestas de la API respetan el encabezado `Accept-Language` enviado por el cliente.

### El contrato `Accept-Language`

Cada respuesta de la API devuelve mensajes de error y exito localizados segun el encabezado `Accept-Language` de la solicitud. Valores soportados: `en`, `ar`, `fr`, `de`, `es`. Si el encabezado esta ausente o contiene un locale no reconocido, la API utiliza `en` como idioma predeterminado.

### Como funciona `req.t()`

El middleware de i18n en `gateway/src/middleware/i18n.ts` analiza el encabezado `Accept-Language`, inicializa un traductor por solicitud y lo adjunta como `req.t()`. Uso en los manejadores de ruta:

```typescript
// Busqueda simple de clave
req.t('errors:auth.unauthorized')

// Con interpolacion
req.t('success:admin.planUpdated', { planName })
```

### Donde se encuentran las traducciones del backend

```
gateway/src/i18n/translations/
  en/    ar/    fr/    de/    es/
    errors.json
    success.json
    validation.json
    emails.json
    billing.json
```

Cada subdirectorio refleja los mismos archivos de namespace. Cada clave en `en/` debe existir en todos los demas directorios de idiomas.

### Agregar una nueva clave de error o exito

1. Agregue la clave a `en/{namespace}.json` (ej. `en/errors.json`).
2. Agregue la traduccion correspondiente a los archivos `ar/`, `fr/`, `de/` y `es/` para el mismo namespace.
3. Use `req.t('namespace:key')` en el manejador de ruta:
   ```typescript
   res.status(403).json({
     error: { code: 'auth.forbidden', message: req.t('errors:auth.forbidden') }
   });
   ```
4. Para funciones utilitarias sin acceso a `req`, use `createError` con la clave i18n:
   ```typescript
   createError(msg, code, status, details, 'errors:auth.forbidden')
   ```
5. Ejecute la prueba `i18n-backend-completeness.test.ts` para verificar que todos los idiomas contengan la nueva clave.

### Localizacion de plantillas de correo electronico

Las plantillas de correo electronico usan `i18n.getFixedT(recipientLocale, 'emails')` para traducir el contenido. El locale proviene de la preferencia de idioma almacenada del usuario (registro del usuario), no del encabezado `Accept-Language` de la solicitud. Esto garantiza que los usuarios reciban correos electronicos en su idioma preferido independientemente de que cliente haya desencadenado la accion.

### Formato de respuesta de error

Los errores de la API siguen uno de dos formatos:

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<cadena localizada>"
  }
}
```

o:

```json
{
  "success": false,
  "error": "<cadena localizada>"
}
```

El valor de `message` / `error` siempre esta localizado segun el encabezado `Accept-Language` de la solicitud (o el locale almacenado del usuario para correos electronicos).

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
