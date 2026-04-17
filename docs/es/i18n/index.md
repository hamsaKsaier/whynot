---
title: "Internacionalizacion (i18n)"
description: "Arquitectura y guias de internacionalizacion de WhyNot QA con soporte para 5 idiomas."
lang: es
draft: true
---

# Internacionalizacion (i18n)

WhyNot QA soporta 5 idiomas: ingles, arabe, frances, aleman y espanol.

## Arquitectura

- **Biblioteca:** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **Backend:** `i18next-http-backend` carga traducciones desde `/locales/{lang}/{namespace}.json`
- **Deteccion:** `i18next-browser-languagedetector` verifica localStorage > navegador > atributo lang del HTML
- **RTL:** El arabe establece `dir="rtl"` en `<html>` mediante LanguageSwitcher
- **Respaldo:** El ingles (`en`) es el idioma de respaldo

## Archivos de locale

```
frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    auth.json
    dashboard.json
    runner.json
    results.json
    settings.json
    billing.json
    landing.json

admin-frontend/public/locales/
  en/    ar/    fr/    de/    es/
    common.json
    admin.json
    auth.json
    settings.json
    superadmin.json
```

## Guias

- [Como agregar una clave de traduccion](./how-to-add-a-translation-key.md)

## Agregar nuevas claves al namespace runner

El namespace `runner` contiene todas las cadenas de la interfaz del ejecutor de pruebas, incluyendo el texto del veredicto de rendimiento. Al agregar nuevas claves, siga el patron de interpolacion usado por las claves de veredicto como ejemplo:

```json
{
  "runner.performance.verdict.okLatency": "Handled {{rps}} req/s with an average latency of {{avgMs}} ms.",
  "runner.performance.verdict.highErrorRate": "{{errorPct}}% of requests failed."
}
```

Consulte [Localizacion de pruebas de rendimiento](../testing/performance.md) para la lista completa de claves de veredicto y sus variables de interpolacion.

## Localizacion del backend

La API del gateway esta completamente localizada. Todas las respuestas de la API respetan el encabezado `Accept-Language` enviado por el cliente.

### El contrato `Accept-Language`

Cada respuesta de la API devuelve mensajes de error y cadenas de exito localizados segun el encabezado `Accept-Language` de la solicitud. Valores soportados: `en`, `ar`, `fr`, `de`, `es`. Si el encabezado esta ausente o contiene un locale no reconocido, la API utiliza `en` como respaldo.

### Como funciona `req.t()`

El middleware de i18n en `gateway/src/middleware/i18n.ts` analiza el encabezado `Accept-Language`, inicializa un traductor por solicitud y lo adjunta como `req.t()`. Uso en los manejadores de ruta:

```typescript
// Simple key lookup
req.t('errors:auth.unauthorized')

// With interpolation
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

## Pruebas

- `i18n-completeness.test.ts` valida la consistencia del arbol de claves en todos los idiomas
- `i18n-no-hardcoded-strings.test.ts` escanea en busca de literales en ingles no traducidos en los componentes de pagina
- `i18n.test.ts` valida la configuracion de i18n (idiomas, RTL, metadatos)

## Configuracion

- Frontend: `frontend/src/i18n.ts`
- Admin: `admin-frontend/src/i18n.ts`
- Selector de idioma: `frontend/src/components/LanguageSwitcher.tsx`

## Pruebas de cobertura i18n

### Agregar una nueva pagina al manifiesto

Cada pagina visible al usuario debe registrarse en `pages-manifest.ts`:

- **Frontend:** `frontend/src/__tests__/pages-manifest.ts`
- **Admin:** `admin-frontend/src/__tests__/pages-manifest.ts`

Agregue una entrada con `key`, `path`, `routePattern`, `component` y `requiresAuth`. La suite `pages-i18n.test.tsx` itera este manifiesto x 5 locales.

### Como funciona el escaner de fugas de ingles

Para los locales que no son ingles, la prueba escanea `document.body.innerText` en busca de secuencias ASCII-Latin de 4 o mas caracteres (`/\b[A-Za-z]{4,}\b/`). Cualquier coincidencia que no este en la lista compartida de marcas (`shared/constants/brand-allowlist.ts`) se marca como una cadena potencialmente no traducida.

Para el arabe especificamente, la prueba ademas verifica que al menos un caracter arabe (`[\u0600-\u06FF]`) este presente en la salida renderizada.

### Agregar un nuevo router de gateway a la prueba de integracion

Edite `gateway/src/__tests__/api/i18n-integration.test.ts`:

1. Agregue rutas de prueba que ejerciten `req.t()` con las claves de traduccion relevantes.
2. Agregue casos de prueba en el bloque describe para cada idioma.
3. Incluya pruebas de respaldo (encabezado `Accept-Language` desconocido o ausente).

### Depuracion de una prueba de pagina-locale fallida

1. Ejecute la prueba especifica: `make shell-frontend npx vitest run --reporter=verbose src/__tests__/pages-i18n.test.tsx`
2. Revise el mensaje de error — lista las palabras latinas no traducidas encontradas.
3. Si la palabra es un cognado legitimo o un nombre de marca, agreguelo a `shared/constants/brand-allowlist.ts`.
4. Si la palabra es texto de interfaz no traducido, agregue la clave de traduccion faltante al archivo JSON del locale.
5. Si la pagina no se renderiza, verifique que todas sus dependencias esten simuladas (mocked) en `pages-i18n.test.tsx`.

### Ejecucion de pruebas

```bash
make test                 # all packages
make test-frontend        # frontend only
make test-admin           # admin-frontend only
make test-backend         # gateway only
```
