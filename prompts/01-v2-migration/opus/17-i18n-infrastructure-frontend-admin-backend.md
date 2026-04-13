# i18n infrastructure: react-i18next in both frontends + `Accept-Language` in gateway

## Agent
`translation-manager` (lead) + `backend-i18n-developer` + skill `backend-i18n`

## Depends on
`16-validate-admin-frontend-rewrite.md`

## Goal
Install the 5-language i18n stack in `frontend/` and `admin-frontend/`, and wire a `req.t()` helper + `Accept-Language` middleware in `gateway/`. Do NOT fill the full translations yet — prompt 19 handles human-quality content. This prompt is the **plumbing** only.

## Reference
- `ARCHITECTURE.md` section 14.
- `/home/serverlessbase/serverless-v2/client/src/i18n.ts`
- `/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/payments/translations/`
- 5 languages: **en, ar, fr, de, es**.

## Task

### 1. Frontend i18n stack
Install in both `frontend/` and `admin-frontend/`:
- `i18next`
- `react-i18next`
- `i18next-http-backend`
- `i18next-browser-languagedetector`

Create:
- `frontend/src/i18n.ts` (mirrors reference):
  ```ts
  import i18n from 'i18next';
  import { initReactI18next } from 'react-i18next';
  import HttpBackend from 'i18next-http-backend';
  import LanguageDetector from 'i18next-browser-languagedetector';

  export const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
  export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
  export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: SUPPORTED_LANGUAGES,
      fallbackLng: 'en',
      load: 'languageOnly',
      interpolation: { escapeValue: false },
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage'],
      },
      ns: ['common', 'auth', 'dashboard', 'runner', 'results', 'settings', 'billing', 'landing'],
      defaultNS: 'common',
    });

  export default i18n;
  ```
- Same file in `admin-frontend/src/i18n.ts` with namespaces: `common`, `admin`, `auth`, `settings`.

Mount `i18n` in `main.tsx`:
```ts
import './i18n';
```
(Must be imported before `<App />` renders.)

### 2. Hook `<html dir>` to language
Update `useDirection.ts` from prompt 07 to read from `i18next` directly:
```ts
import { useTranslation } from 'react-i18next';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/i18n';

export function useDirection() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage;
  return RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}
```

### 3. Language switcher
`frontend/src/components/LanguageSwitcher.tsx` and same in admin:
- Shadcn `DropdownMenu` with flag icons + native names (English, العربية, Français, Deutsch, Español).
- On select: `i18n.changeLanguage(lang)` + writes `localStorage.i18nextLng` + updates `<html lang dir>`.
- Accessible: `aria-label`, keyboard navigable.

Mount in both apps' Header components.

### 4. Translation file scaffolding
Create the full directory tree — one file per namespace per language — in both apps:

```
frontend/public/locales/
  en/common.json, auth.json, dashboard.json, runner.json, results.json, settings.json, billing.json, landing.json
  ar/… (same)
  fr/…
  de/…
  es/…
admin-frontend/public/locales/
  en/common.json, admin.json, auth.json, settings.json
  ar/…, fr/…, de/…, es/…
```

Populate each JSON as a nested object copy of the English files already touched in phases 2–3. The non-English files start as structural clones with English values (placeholders). Prompt 19 replaces the English placeholders in ar/fr/de/es with real translations.

### 5. Backend i18n — gateway
Install in `gateway/`:
- `i18next`
- `i18next-fs-backend`
- `accept-language-parser`

Create:
- `gateway/src/i18n/index.ts` — initializes i18next with filesystem backend, namespaces `errors`, `success`, `emails`, `validation`, `billing`.
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/{errors,success,emails,validation,billing}.json` — populated with English placeholders.
- `gateway/src/middleware/i18n.ts`:
  ```ts
  import type { Request, Response, NextFunction } from 'express';
  import acceptLanguage from 'accept-language-parser';
  import i18next from '../i18n';

  const SUPPORTED = ['en', 'ar', 'fr', 'de', 'es'];
  export function i18nMiddleware(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers['accept-language'] ?? '';
    const lang = acceptLanguage.pick(SUPPORTED, header) ?? 'en';
    (req as any).lang = lang;
    (req as any).t = (key: string, vars?: Record<string, unknown>) =>
      i18next.t(key, { ...vars, lng: lang });
    next();
  }
  ```
- Wire the middleware in `gateway/src/app.ts` before route handlers.

### 6. Convert gateway error responses to use `req.t()`
Sweep `gateway/src/api/**` and replace every hardcoded error message string with a key lookup. For each message, add the key to `errors.json` in English. Other languages come in prompt 19.

Example:
```ts
// before
res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
// after
res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: req.t('errors:auth.invalidCredentials') } });
```

### 7. Completeness test scaffolding
Create the schema-completeness test infrastructure but do NOT enforce 5-language parity yet (that's prompt 20 once translations are filled):

- `frontend/src/__tests__/i18n-completeness.test.ts`
- `admin-frontend/src/__tests__/i18n-completeness.test.ts`
- `gateway/src/__tests__/i18n-completeness.test.ts`

Each reads every locale file in its domain and asserts:
- All 5 languages have the **same set of namespaces**.
- Every namespace has the **same key tree** (recursive compare against the `en` reference).
- Keys may have English placeholder values in ar/fr/de/es during phases 2–3; a future assertion in prompt 20 swaps to "non-empty, not-equal-to-English" for content parity.

### 8. Update `ARCHITECTURE.md` section 14
Replace the placeholder with the real library (react-i18next), the namespace list, the 5 languages, the RTL policy, and the `req.t()` pattern for the backend.

### Files to create/modify
- `frontend/src/i18n.ts`, `admin-frontend/src/i18n.ts` — new.
- `frontend/src/main.tsx`, `admin-frontend/src/main.tsx` — import `./i18n` before App render.
- `frontend/src/hooks/useDirection.ts`, `admin-frontend/src/hooks/useDirection.ts` — updated.
- `frontend/src/components/LanguageSwitcher.tsx`, `admin-frontend/src/components/LanguageSwitcher.tsx` — new.
- `frontend/public/locales/{en,ar,fr,de,es}/{common,auth,dashboard,runner,results,settings,billing,landing}.json` — new (40 files).
- `admin-frontend/public/locales/{en,ar,fr,de,es}/{common,admin,auth,settings}.json` — new (20 files).
- `gateway/src/i18n/index.ts`, `gateway/src/middleware/i18n.ts` — new.
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/{errors,success,emails,validation,billing}.json` — new (25 files).
- `gateway/src/api/**` — error responses updated to use `req.t()`.
- `frontend/src/__tests__/i18n-completeness.test.ts`, `admin-frontend/src/__tests__/i18n-completeness.test.ts`, `gateway/src/__tests__/i18n-completeness.test.ts` — new.
- `ARCHITECTURE.md` — section 14 updated.

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

### Tests
- Completeness test (step 7): passes when all 5 languages have identical key trees to `en`.
- **Vitest frontend**: mount a component that uses `useTranslation()` + `i18n.changeLanguage('fr')` and assert it re-renders with the French string (placeholder English in this phase, but the mechanism exercises).
- **Vitest gateway**: Supertest hits 3 error paths with `Accept-Language: fr, ar, de` and asserts response's `error.message` corresponds to the per-language file (placeholder en at this phase).
- **Playwright**: language switcher in frontend + admin-frontend cycles through all 5 languages; `<html lang dir>` updates correctly; `dir="rtl"` set for Arabic.
- Coverage: 100% for every file touched.

### i18n
- This prompt IS about i18n infrastructure.
- No user-facing content yet (placeholders). Prompt 19 fills them.

### Documentation
- `/docs/i18n.md` — English only. Developer guide: how to add a new string (key + namespace), how the completeness test works, how `Accept-Language` flows server-side.

### Acceptance criteria
- [ ] react-i18next stack installed in both apps; Accept-Language middleware in gateway.
- [ ] All locale files (60 frontend + 25 backend) exist with the same key shape.
- [ ] `<html dir>` updates on language change.
- [ ] Language switcher works in both apps.
- [ ] Completeness test passes (structural parity).
- [ ] All hardcoded gateway error messages replaced with `req.t()` calls.
- [ ] Vitest + Playwright tests green.
- [ ] Coverage for touched files = 100%.
- [ ] `ARCHITECTURE.md` section 14 updated.
- [ ] No untouchable path changes.
