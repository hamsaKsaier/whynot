import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { i18nMiddleware } from '../../middleware/i18n';
import { errorHandler, createError } from '../../middleware/error-handler';
import i18n from '../../i18n';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
type Lang = (typeof SUPPORTED_LANGUAGES)[number];

/** Load a translation namespace file for a given language. */
function loadTranslations(lang: Lang, ns: string): Record<string, string> {
  const filePath = path.join(
    __dirname,
    '../../i18n/translations',
    lang,
    `${ns}.json`,
  );
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** Replace i18next-style {{var}} interpolation placeholders with values. */
function interpolate(
  template: string,
  vars: Record<string, unknown>,
): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return result;
}

// Pre-load all translation maps so assertions can reference expected values.
const errors: Record<Lang, Record<string, string>> = {} as any;
const success: Record<Lang, Record<string, string>> = {} as any;
const validation: Record<Lang, Record<string, string>> = {} as any;
for (const lang of SUPPORTED_LANGUAGES) {
  errors[lang] = loadTranslations(lang, 'errors');
  success[lang] = loadTranslations(lang, 'success');
  validation[lang] = loadTranslations(lang, 'validation');
}

/** Helper to issue a request with a specific Accept-Language header. */
function requestWithLocale(
  app: express.Express,
  method: 'get' | 'post' | 'put' | 'delete',
  urlPath: string,
  lang: string,
  body?: any,
) {
  const req = request(app)[method](urlPath).set('Accept-Language', lang);
  if (body) req.send(body);
  return req;
}

// ---------------------------------------------------------------------------
// Express app that exercises i18n patterns across multiple router categories
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(i18nMiddleware);

// ---- SUCCESS ROUTES -------------------------------------------------------

app.get('/test/auth/logout', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:auth.loggedOut') });
});

app.post('/test/billing/subscribe', (req, res) => {
  const t = (req as any).t;
  res.status(201).json({
    success: true,
    message: t('success:billing.subscriptionCreated'),
  });
});

app.delete('/test/project', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:project.deleted') });
});

app.post('/test/scan/start', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:scan.started') });
});

app.put('/test/password', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:password.updated') });
});

app.put('/test/flags', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:flags.updated') });
});

app.post('/test/monitor/trigger', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:monitor.triggered') });
});

app.delete('/test/workspace', (req, res) => {
  const t = (req as any).t;
  res.json({ success: true, message: t('success:workspace.deleted') });
});

// ---- ERROR ROUTES ---------------------------------------------------------

app.post('/test/auth/login-fail', (req, res) => {
  const t = (req as any).t;
  res
    .status(401)
    .json({ success: false, error: t('errors:auth.invalidCredentials') });
});

app.post('/test/auth/register-duplicate', (req, res) => {
  const t = (req as any).t;
  res
    .status(409)
    .json({ success: false, error: t('errors:auth.emailInUse') });
});

app.post('/test/billing/invalid-plan', (req, res) => {
  const t = (req as any).t;
  res
    .status(400)
    .json({ success: false, error: t('errors:billing.invalidPlan') });
});

app.post('/test/billing/card-declined', (req, res) => {
  const t = (req as any).t;
  res
    .status(402)
    .json({ success: false, error: t('errors:billing.cardDeclined') });
});

app.get('/test/billing/not-found', (req, res) => {
  const t = (req as any).t;
  res
    .status(404)
    .json({ success: false, error: t('errors:billing.subscriptionNotFound') });
});

app.get('/test/resource/forbidden', (req, res) => {
  const t = (req as any).t;
  res
    .status(403)
    .json({ success: false, error: t('errors:auth.forbidden') });
});

app.get('/test/server-error', (req, res) => {
  const t = (req as any).t;
  res.status(500).json({
    success: false,
    error: t('errors:ai.providerUnavailable', { provider: 'TestAI' }),
  });
});

app.delete('/test/workspace-last', (req, res) => {
  const t = (req as any).t;
  res
    .status(422)
    .json({ success: false, error: t('errors:business.lastWorkspace') });
});

// ---- VALIDATION ROUTES ----------------------------------------------------

app.post('/test/validate/required', (req, res) => {
  const t = (req as any).t;
  res
    .status(400)
    .json({ success: false, error: t('validation:required', { field: 'email' }) });
});

app.post('/test/validate/email', (req, res) => {
  const t = (req as any).t;
  res.status(400).json({ success: false, error: t('validation:email') });
});

app.post('/test/validate/min-length', (req, res) => {
  const t = (req as any).t;
  res.status(400).json({
    success: false,
    error: t('validation:minLength', { field: 'password', min: 8 }),
  });
});

// Error handler must be registered AFTER routes.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Wait for i18next to load all translation files before running tests.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    if (i18n.isInitialized) return resolve();
    i18n.on('initialized', () => resolve());
  });
});

// ---------------------------------------------------------------------------
// Route definitions used to drive parameterised tests
// ---------------------------------------------------------------------------

interface SuccessRoute {
  description: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  expectedStatus: number;
  translationKey: string; // key inside success.json (without namespace prefix)
}

interface ErrorRoute {
  description: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  expectedStatus: number;
  translationKey: string; // key inside errors.json (without namespace prefix)
  interpolationVars?: Record<string, unknown>;
}

interface ValidationRoute {
  description: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  expectedStatus: number;
  translationKey: string; // key inside validation.json (without namespace prefix)
  interpolationVars?: Record<string, unknown>;
}

const successRoutes: SuccessRoute[] = [
  {
    description: 'auth logout (200)',
    method: 'get',
    path: '/test/auth/logout',
    expectedStatus: 200,
    translationKey: 'auth.loggedOut',
  },
  {
    description: 'billing subscribe (201)',
    method: 'post',
    path: '/test/billing/subscribe',
    expectedStatus: 201,
    translationKey: 'billing.subscriptionCreated',
  },
  {
    description: 'project delete (200)',
    method: 'delete',
    path: '/test/project',
    expectedStatus: 200,
    translationKey: 'project.deleted',
  },
  {
    description: 'scan start (200)',
    method: 'post',
    path: '/test/scan/start',
    expectedStatus: 200,
    translationKey: 'scan.started',
  },
  {
    description: 'password update (200)',
    method: 'put',
    path: '/test/password',
    expectedStatus: 200,
    translationKey: 'password.updated',
  },
  {
    description: 'flags update (200)',
    method: 'put',
    path: '/test/flags',
    expectedStatus: 200,
    translationKey: 'flags.updated',
  },
  {
    description: 'monitor trigger (200)',
    method: 'post',
    path: '/test/monitor/trigger',
    expectedStatus: 200,
    translationKey: 'monitor.triggered',
  },
  {
    description: 'workspace delete (200)',
    method: 'delete',
    path: '/test/workspace',
    expectedStatus: 200,
    translationKey: 'workspace.deleted',
  },
];

const errorRoutes: ErrorRoute[] = [
  {
    description: 'auth invalid credentials (401)',
    method: 'post',
    path: '/test/auth/login-fail',
    expectedStatus: 401,
    translationKey: 'auth.invalidCredentials',
  },
  {
    description: 'auth email in use (409)',
    method: 'post',
    path: '/test/auth/register-duplicate',
    expectedStatus: 409,
    translationKey: 'auth.emailInUse',
  },
  {
    description: 'billing invalid plan (400)',
    method: 'post',
    path: '/test/billing/invalid-plan',
    expectedStatus: 400,
    translationKey: 'billing.invalidPlan',
  },
  {
    description: 'billing card declined (402)',
    method: 'post',
    path: '/test/billing/card-declined',
    expectedStatus: 402,
    translationKey: 'billing.cardDeclined',
  },
  {
    description: 'billing subscription not found (404)',
    method: 'get',
    path: '/test/billing/not-found',
    expectedStatus: 404,
    translationKey: 'billing.subscriptionNotFound',
  },
  {
    description: 'resource forbidden (403)',
    method: 'get',
    path: '/test/resource/forbidden',
    expectedStatus: 403,
    translationKey: 'auth.forbidden',
  },
  {
    description: 'server error with interpolation (500)',
    method: 'get',
    path: '/test/server-error',
    expectedStatus: 500,
    translationKey: 'ai.providerUnavailable',
    interpolationVars: { provider: 'TestAI' },
  },
  {
    description: 'business last workspace (422)',
    method: 'delete',
    path: '/test/workspace-last',
    expectedStatus: 422,
    translationKey: 'business.lastWorkspace',
  },
];

const validationRoutes: ValidationRoute[] = [
  {
    description: 'required field with interpolation (400)',
    method: 'post',
    path: '/test/validate/required',
    expectedStatus: 400,
    translationKey: 'required',
    interpolationVars: { field: 'email' },
  },
  {
    description: 'email validation (400)',
    method: 'post',
    path: '/test/validate/email',
    expectedStatus: 400,
    translationKey: 'email',
  },
  {
    description: 'min length with interpolation (400)',
    method: 'post',
    path: '/test/validate/min-length',
    expectedStatus: 400,
    translationKey: 'minLength',
    interpolationVars: { field: 'password', min: 8 },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('i18n integration — all routers x 5 languages', () => {
  // =========================================================================
  // SUCCESS PATHS
  // =========================================================================
  describe('success paths', () => {
    for (const route of successRoutes) {
      describe(route.description, () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          it(`returns localized success message for ${lang}`, async () => {
            const res = await requestWithLocale(
              app,
              route.method,
              route.path,
              lang,
            );

            expect(res.status).toBe(route.expectedStatus);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe(
              success[lang][route.translationKey],
            );
          });
        }

        it('falls back to English for unsupported Accept-Language (zz-ZZ)', async () => {
          const res = await requestWithLocale(
            app,
            route.method,
            route.path,
            'zz-ZZ',
          );

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe(
            success.en[route.translationKey],
          );
        });

        it('falls back to English when no Accept-Language header', async () => {
          const res = await request(app)[route.method](route.path);

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe(
            success.en[route.translationKey],
          );
        });
      });
    }
  });

  // =========================================================================
  // ERROR PATHS
  // =========================================================================
  describe('error paths', () => {
    for (const route of errorRoutes) {
      describe(route.description, () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          it(`returns localized error message for ${lang}`, async () => {
            const res = await requestWithLocale(
              app,
              route.method,
              route.path,
              lang,
            );

            expect(res.status).toBe(route.expectedStatus);
            expect(res.body.success).toBe(false);

            const rawTemplate = errors[lang][route.translationKey];
            const expected = route.interpolationVars
              ? interpolate(rawTemplate, route.interpolationVars)
              : rawTemplate;

            expect(res.body.error).toBe(expected);
          });
        }

        it('falls back to English for unsupported Accept-Language (zz-ZZ)', async () => {
          const res = await requestWithLocale(
            app,
            route.method,
            route.path,
            'zz-ZZ',
          );

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(false);

          const rawTemplate = errors.en[route.translationKey];
          const expected = route.interpolationVars
            ? interpolate(rawTemplate, route.interpolationVars)
            : rawTemplate;

          expect(res.body.error).toBe(expected);
        });

        it('falls back to English when no Accept-Language header', async () => {
          const res = await request(app)[route.method](route.path);

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(false);

          const rawTemplate = errors.en[route.translationKey];
          const expected = route.interpolationVars
            ? interpolate(rawTemplate, route.interpolationVars)
            : rawTemplate;

          expect(res.body.error).toBe(expected);
        });
      });
    }
  });

  // =========================================================================
  // VALIDATION PATHS
  // =========================================================================
  describe('validation paths', () => {
    for (const route of validationRoutes) {
      describe(route.description, () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          it(`returns localized validation message for ${lang}`, async () => {
            const res = await requestWithLocale(
              app,
              route.method,
              route.path,
              lang,
            );

            expect(res.status).toBe(route.expectedStatus);
            expect(res.body.success).toBe(false);

            const rawTemplate = validation[lang][route.translationKey];
            const expected = route.interpolationVars
              ? interpolate(rawTemplate, route.interpolationVars)
              : rawTemplate;

            expect(res.body.error).toBe(expected);
          });
        }

        it('falls back to English for unsupported Accept-Language (zz-ZZ)', async () => {
          const res = await requestWithLocale(
            app,
            route.method,
            route.path,
            'zz-ZZ',
          );

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(false);

          const rawTemplate = validation.en[route.translationKey];
          const expected = route.interpolationVars
            ? interpolate(rawTemplate, route.interpolationVars)
            : rawTemplate;

          expect(res.body.error).toBe(expected);
        });

        it('falls back to English when no Accept-Language header', async () => {
          const res = await request(app)[route.method](route.path);

          expect(res.status).toBe(route.expectedStatus);
          expect(res.body.success).toBe(false);

          const rawTemplate = validation.en[route.translationKey];
          const expected = route.interpolationVars
            ? interpolate(rawTemplate, route.interpolationVars)
            : rawTemplate;

          expect(res.body.error).toBe(expected);
        });
      });
    }
  });

  // =========================================================================
  // CROSS-CUTTING: translations differ across languages
  // =========================================================================
  describe('translations differ across languages', () => {
    const successKeysToCheck = [
      'auth.loggedOut',
      'billing.subscriptionCreated',
      'project.deleted',
      'scan.started',
      'password.updated',
      'flags.updated',
      'monitor.triggered',
      'workspace.deleted',
    ] as const;

    const errorKeysToCheck = [
      'auth.invalidCredentials',
      'auth.emailInUse',
      'billing.invalidPlan',
      'billing.cardDeclined',
      'billing.subscriptionNotFound',
      'auth.forbidden',
      'ai.providerUnavailable',
      'business.lastWorkspace',
    ] as const;

    const validationKeysToCheck = [
      'required',
      'email',
      'minLength',
    ] as const;

    describe('success keys', () => {
      for (const key of successKeysToCheck) {
        it(`success:${key} differs in at least one non-English language`, () => {
          const enValue = success.en[key];
          const otherValues = (['ar', 'fr', 'de', 'es'] as const).map(
            (lang) => success[lang][key],
          );
          const hasDifference = otherValues.some((v) => v !== enValue);
          expect(hasDifference).toBe(true);
        });
      }
    });

    describe('error keys', () => {
      for (const key of errorKeysToCheck) {
        it(`errors:${key} differs in at least one non-English language`, () => {
          const enValue = errors.en[key];
          const otherValues = (['ar', 'fr', 'de', 'es'] as const).map(
            (lang) => errors[lang][key],
          );
          const hasDifference = otherValues.some((v) => v !== enValue);
          expect(hasDifference).toBe(true);
        });
      }
    });

    describe('validation keys', () => {
      for (const key of validationKeysToCheck) {
        it(`validation:${key} differs in at least one non-English language`, () => {
          const enValue = validation.en[key];
          const otherValues = (['ar', 'fr', 'de', 'es'] as const).map(
            (lang) => validation[lang][key],
          );
          const hasDifference = otherValues.some((v) => v !== enValue);
          expect(hasDifference).toBe(true);
        });
      }
    });
  });

  // =========================================================================
  // NO RAW i18n KEYS IN RESPONSES
  // =========================================================================
  describe('responses do not expose raw i18n keys', () => {
    const allSuccessEndpoints = successRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      field: 'message' as const,
    }));

    const allErrorEndpoints = errorRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      field: 'error' as const,
    }));

    const allValidationEndpoints = validationRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      field: 'error' as const,
    }));

    const allEndpoints = [
      ...allSuccessEndpoints,
      ...allErrorEndpoints,
      ...allValidationEndpoints,
    ];

    for (const endpoint of allEndpoints) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.path} does not contain raw namespace prefix in "${endpoint.field}" field`, async () => {
        const res = await requestWithLocale(
          app,
          endpoint.method,
          endpoint.path,
          'en',
        );

        const value = res.body[endpoint.field];
        expect(value).toBeTruthy();
        expect(value).not.toContain('errors:');
        expect(value).not.toContain('success:');
        expect(value).not.toContain('validation:');
        expect(value).not.toContain('billing:');
        expect(value).not.toContain('emails:');
      });
    }
  });
});
