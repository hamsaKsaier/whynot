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

/** Load the errors.json translation file for a given language. */
function loadErrorTranslations(lang: Lang): Record<string, string> {
  const filePath = path.join(
    __dirname,
    '../../i18n/translations',
    lang,
    'errors.json',
  );
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Pre-load all translation maps so assertions can reference expected values.
const translations: Record<Lang, Record<string, string>> = {} as any;
for (const lang of SUPPORTED_LANGUAGES) {
  translations[lang] = loadErrorTranslations(lang);
}

// ---------------------------------------------------------------------------
// Express app that exercises the same i18n patterns as the real middleware
// ---------------------------------------------------------------------------

const app = express();
app.use(i18nMiddleware);

// --- Auth middleware pattern (401 – missing token) -------------------------
app.get('/test/auth', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(401).json({ success: false, error: t('errors:auth.unauthorized') });
});

// --- Auth middleware pattern (401 – invalid token) -------------------------
app.get('/test/auth/invalid-token', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(401).json({ success: false, error: t('errors:auth.invalidToken') });
});

// --- Subscription check pattern (403 – no active subscription) -------------
app.get('/test/subscription', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(403).json({
    success: false,
    error: t('errors:subscription.notActive'),
    code: 'NO_SUBSCRIPTION',
    details: { upgrade_url: '/billing' },
  });
});

// --- Subscription check pattern (403 – inactive subscription) --------------
app.get('/test/subscription/inactive', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(403).json({
    success: false,
    error: t('errors:subscription.inactive'),
    code: 'SUBSCRIPTION_INACTIVE',
    details: { upgrade_url: '/billing' },
  });
});

// --- Subscription check pattern (403 – trial expired) ----------------------
app.get('/test/subscription/trial-expired', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(403).json({
    success: false,
    error: t('errors:subscription.trialExpired'),
    code: 'TRIAL_EXPIRED',
    details: { upgrade_url: '/billing' },
  });
});

// --- Feature gate pattern (403 – feature not available) --------------------
app.get('/test/feature-gate', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(403).json({
    success: false,
    error: t('errors:feature.notAvailable'),
    code: 'FEATURE_NOT_AVAILABLE',
    details: { feature: 'advanced_analytics', upgrade_url: '/billing' },
  });
});

// --- Feature gate pattern (403 – feature limit reached) --------------------
app.get('/test/feature-limit', (req, res) => {
  const t = (req as any).t ?? ((k: string) => k);
  res.status(403).json({
    success: false,
    error: t('errors:feature.limitReached', { limit: 10 }),
    code: 'FEATURE_LIMIT_REACHED',
    details: { feature: 'max_projects', limit: 10, current: 10, upgrade_url: '/billing' },
  });
});

// --- Rate limit pattern (429 – throws via createError -> errorHandler) ------
app.get('/test/rate-limit', (req, _res) => {
  const t = (req as any).t ?? ((k: string) => k);
  throw createError(
    t('errors:rateLimit.apiGeneral'),
    429,
    'RATE_LIMIT_EXCEEDED',
  );
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
// Tests
// ---------------------------------------------------------------------------

describe('per-router i18n API responses', () => {
  // -------------------------------------------------------------------------
  // Auth middleware — 401 (missing token)
  // -------------------------------------------------------------------------
  describe('auth middleware — 401 unauthorized', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized auth.unauthorized for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/auth')
          .set('Accept-Language', lang);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['auth.unauthorized']);
      });
    }

    it('falls back to English for unknown Accept-Language (xx)', async () => {
      const res = await request(app)
        .get('/test/auth')
        .set('Accept-Language', 'xx');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe(translations.en['auth.unauthorized']);
    });

    it('falls back to English when no Accept-Language header', async () => {
      const res = await request(app).get('/test/auth');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe(translations.en['auth.unauthorized']);
    });
  });

  // -------------------------------------------------------------------------
  // Auth middleware — 401 (invalid token)
  // -------------------------------------------------------------------------
  describe('auth middleware — 401 invalid token', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized auth.invalidToken for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/auth/invalid-token')
          .set('Accept-Language', lang);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['auth.invalidToken']);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Rate limit middleware — 429
  // -------------------------------------------------------------------------
  describe('rate limit middleware — 429', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized rateLimit.apiGeneral for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/rate-limit')
          .set('Accept-Language', lang);

        expect(res.status).toBe(429);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['rateLimit.apiGeneral']);
      });
    }

    it('falls back to English for unknown Accept-Language (ja-JP)', async () => {
      const res = await request(app)
        .get('/test/rate-limit')
        .set('Accept-Language', 'ja-JP');

      expect(res.status).toBe(429);
      expect(res.body.error).toBe(translations.en['rateLimit.apiGeneral']);
    });
  });

  // -------------------------------------------------------------------------
  // Subscription check — 403 (no active subscription)
  // -------------------------------------------------------------------------
  describe('subscription check — 403 no active subscription', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized subscription.notActive for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/subscription')
          .set('Accept-Language', lang);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['subscription.notActive']);
        expect(res.body.code).toBe('NO_SUBSCRIPTION');
      });
    }

    it('falls back to English for unknown Accept-Language (zh-CN)', async () => {
      const res = await request(app)
        .get('/test/subscription')
        .set('Accept-Language', 'zh-CN');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(translations.en['subscription.notActive']);
    });
  });

  // -------------------------------------------------------------------------
  // Subscription check — 403 (inactive subscription)
  // -------------------------------------------------------------------------
  describe('subscription check — 403 inactive subscription', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized subscription.inactive for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/subscription/inactive')
          .set('Accept-Language', lang);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['subscription.inactive']);
        expect(res.body.code).toBe('SUBSCRIPTION_INACTIVE');
      });
    }
  });

  // -------------------------------------------------------------------------
  // Subscription check — 403 (trial expired)
  // -------------------------------------------------------------------------
  describe('subscription check — 403 trial expired', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized subscription.trialExpired for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/subscription/trial-expired')
          .set('Accept-Language', lang);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['subscription.trialExpired']);
        expect(res.body.code).toBe('TRIAL_EXPIRED');
      });
    }
  });

  // -------------------------------------------------------------------------
  // Feature gate — 403 (feature not available)
  // -------------------------------------------------------------------------
  describe('feature gate — 403 not available', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized feature.notAvailable for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/feature-gate')
          .set('Accept-Language', lang);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(translations[lang]['feature.notAvailable']);
        expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
      });
    }

    it('falls back to English for unknown Accept-Language (pt-BR)', async () => {
      const res = await request(app)
        .get('/test/feature-gate')
        .set('Accept-Language', 'pt-BR');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(translations.en['feature.notAvailable']);
    });
  });

  // -------------------------------------------------------------------------
  // Feature gate — 403 (limit reached, with interpolation)
  // -------------------------------------------------------------------------
  describe('feature gate — 403 limit reached (interpolated)', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      it(`returns localized feature.limitReached with limit=10 for ${lang}`, async () => {
        const res = await request(app)
          .get('/test/feature-limit')
          .set('Accept-Language', lang);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        // The translated string should have the interpolation variable resolved.
        const expected = translations[lang]['feature.limitReached'].replace(
          '{{limit}}',
          '10',
        );
        expect(res.body.error).toBe(expected);
        expect(res.body.code).toBe('FEATURE_LIMIT_REACHED');
      });
    }
  });

  // -------------------------------------------------------------------------
  // Cross-cutting: each language produces a DIFFERENT string than English
  // (guards against translations that simply copy the English source)
  // -------------------------------------------------------------------------
  describe('translations differ across languages', () => {
    const keysToCheck = [
      'auth.unauthorized',
      'subscription.notActive',
      'feature.notAvailable',
      'rateLimit.apiGeneral',
    ] as const;

    for (const key of keysToCheck) {
      it(`${key} differs in at least one non-English language`, () => {
        const enValue = translations.en[key];
        const otherValues = (['ar', 'fr', 'de', 'es'] as const).map(
          (lang) => translations[lang][key],
        );
        // At least one non-English translation must differ from English
        const hasDifference = otherValues.some((v) => v !== enValue);
        expect(hasDifference).toBe(true);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Verify error responses never leak raw i18n keys
  // -------------------------------------------------------------------------
  describe('error responses do not expose raw i18n keys', () => {
    const endpoints = [
      '/test/auth',
      '/test/auth/invalid-token',
      '/test/subscription',
      '/test/subscription/inactive',
      '/test/subscription/trial-expired',
      '/test/feature-gate',
      '/test/feature-limit',
      '/test/rate-limit',
    ];

    for (const endpoint of endpoints) {
      it(`${endpoint} does not contain "errors:" prefix in error field`, async () => {
        const res = await request(app)
          .get(endpoint)
          .set('Accept-Language', 'en');

        expect(res.body.error).toBeTruthy();
        expect(res.body.error).not.toContain('errors:');
      });
    }
  });
});
