---
title: "Internationalization (i18n)"
description: "WhyNot QA supports 5 languages: English, Arabic, French, German, and Spanish."
lang: en
draft: false
---

# Internationalization (i18n)

WhyNot QA supports 5 languages: English, Arabic, French, German, and Spanish.

## Architecture

- **Library:** [react-i18next](https://react.i18next.com/) v15 + i18next v23
- **Backend:** `i18next-http-backend` loads translations from `/locales/{lang}/{namespace}.json`
- **Detection:** `i18next-browser-languagedetector` checks localStorage > browser > HTML lang attribute
- **RTL:** Arabic sets `dir="rtl"` on `<html>` via LanguageSwitcher
- **Fallback:** English (`en`) is the fallback language

## Locale Files

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

## Guides

- [How to Add a Translation Key](./how-to-add-a-translation-key.md)

## Adding New Keys to the Runner Namespace

The `runner` namespace holds all test-runner UI strings, including performance verdict copy. When adding new keys, follow the interpolation pattern used by the verdict keys as an example:

```json
{
  "runner.performance.verdict.okLatency": "Handled {{rps}} req/s with an average latency of {{avgMs}} ms.",
  "runner.performance.verdict.highErrorRate": "{{errorPct}}% of requests failed."
}
```

See [Performance Testing Localization](../testing/performance.md) for the full list of verdict keys and their interpolation variables.

## Backend Localization

The gateway API is fully localized. All API responses honor the `Accept-Language` header sent by the client.

### The `Accept-Language` Contract

Every API response returns localized error messages and success strings based on the `Accept-Language` request header. Supported values: `en`, `ar`, `fr`, `de`, `es`. If the header is missing or contains an unrecognized locale, the API falls back to `en`.

### How `req.t()` Works

The i18n middleware at `gateway/src/middleware/i18n.ts` parses the `Accept-Language` header, initializes a per-request translator, and attaches it as `req.t()`. Usage in route handlers:

```typescript
// Simple key lookup
req.t('errors:auth.unauthorized')

// With interpolation
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

Each subdirectory mirrors the same namespace files. Every key in `en/` must exist in all other language directories.

### Adding a New Error or Success Key

1. Add the key to `en/{namespace}.json` (e.g., `en/errors.json`).
2. Add the corresponding translation to `ar/`, `fr/`, `de/`, and `es/` files for the same namespace.
3. Use `req.t('namespace:key')` in the route handler:
   ```typescript
   res.status(403).json({
     error: { code: 'auth.forbidden', message: req.t('errors:auth.forbidden') }
   });
   ```
4. For utility functions that don't have access to `req`, use `createError` with the i18n key:
   ```typescript
   createError(msg, code, status, details, 'errors:auth.forbidden')
   ```
5. Run the `i18n-backend-completeness.test.ts` test to verify all languages have the new key.

### Email Template Localization

Email templates use `i18n.getFixedT(recipientLocale, 'emails')` to translate content. The locale comes from the user's stored language preference (user record), not from the request's `Accept-Language` header. This ensures users receive emails in their preferred language regardless of which client triggered the action.

### Error Response Shape

API errors follow one of two shapes:

```json
{
  "error": {
    "code": "auth.invalidCredentials",
    "message": "<localized string>"
  }
}
```

or:

```json
{
  "success": false,
  "error": "<localized string>"
}
```

The `message` / `error` value is always localized based on the request's `Accept-Language` header (or the user's stored locale for emails).

## Testing

- `i18n-completeness.test.ts` validates key tree consistency across all languages
- `i18n-no-hardcoded-strings.test.ts` scans for untranslated English literals in page components
- `i18n.test.ts` validates i18n configuration (languages, RTL, metadata)

## Configuration

- Frontend: `frontend/src/i18n.ts`
- Admin: `admin-frontend/src/i18n.ts`
- Language switcher: `frontend/src/components/LanguageSwitcher.tsx`

## Testing i18n coverage

### Adding a new page to the manifest

Every user-facing page must be registered in `pages-manifest.ts`:

- **Frontend:** `frontend/src/__tests__/pages-manifest.ts`
- **Admin:** `admin-frontend/src/__tests__/pages-manifest.ts`

Add an entry with `key`, `path`, `routePattern`, `component`, and `requiresAuth`. The `pages-i18n.test.tsx` suite iterates this manifest × 5 locales.

### How the English-leak scanner works

For non-English locales, the test scans `document.body.innerText` for 4+ character ASCII-Latin-only runs (`/\b[A-Za-z]{4,}\b/`). Any match not in the shared brand allowlist (`shared/constants/brand-allowlist.ts`) is flagged as a potential untranslated string.

For Arabic specifically, the test additionally asserts that at least one Arabic character (`[\u0600-\u06FF]`) is present in the rendered output.

### Adding a new gateway router to the integration test

Edit `gateway/src/__tests__/api/i18n-integration.test.ts`:

1. Add test routes that exercise `req.t()` with the relevant translation keys.
2. Add test cases in the describe block for each language.
3. Include fallback tests (unknown `Accept-Language` and missing header).

### Debugging a failing page-locale test

1. Run the specific test: `make shell-frontend npx vitest run --reporter=verbose src/__tests__/pages-i18n.test.tsx`
2. Check the error message — it lists the untranslated Latin words found.
3. If the word is a legitimate cognate or brand name, add it to `shared/constants/brand-allowlist.ts`.
4. If the word is untranslated UI text, add the missing translation key to the locale JSON file.
5. If the page fails to render, check that all its dependencies are mocked in `pages-i18n.test.tsx`.

### Running tests

```bash
make test                 # all packages
make test-frontend        # frontend only
make test-admin           # admin-frontend only
make test-backend         # gateway only
```
