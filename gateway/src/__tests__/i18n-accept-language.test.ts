import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { i18nMiddleware } from '../middleware/i18n';
import i18n from '../i18n';

const app = express();

app.use(i18nMiddleware);

app.get('/test-i18n', (req, res) => {
  const t = (req as any).t;
  const lang = (req as any).lang;
  res.json({
    lang,
    message: t('errors:auth.invalidCredentials'),
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    if (i18n.isInitialized) return resolve();
    i18n.on('initialized', () => resolve());
  });
});

describe('gateway Accept-Language handling', () => {
  it('returns English for Accept-Language: en', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'en');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('en');
    expect(res.body.message).toBeTruthy();
    expect(typeof res.body.message).toBe('string');
  });

  it('returns French for Accept-Language: fr', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'fr');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('fr');
    expect(res.body.message).toBeTruthy();
  });

  it('returns Arabic for Accept-Language: ar', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'ar');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('ar');
    expect(res.body.message).toBeTruthy();
  });

  it('returns German for Accept-Language: de', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'de');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('de');
    expect(res.body.message).toBeTruthy();
  });

  it('returns Spanish for Accept-Language: es', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'es');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('es');
    expect(res.body.message).toBeTruthy();
  });

  it('falls back to en for unsupported language (zz)', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'zz');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('en');
  });

  it('falls back to en when no Accept-Language header', async () => {
    const res = await request(app)
      .get('/test-i18n');
    expect(res.status).toBe(200);
    expect(res.body.lang).toBe('en');
  });

  it('req.t() resolves keys via i18next', async () => {
    const res = await request(app)
      .get('/test-i18n')
      .set('Accept-Language', 'en');
    expect(res.body.message).not.toContain('errors:');
  });
});
