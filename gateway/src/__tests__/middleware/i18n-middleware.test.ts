import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock i18n module before importing the middleware
vi.mock('../../i18n', () => ({
  default: {
    t: vi.fn((key: string, opts?: any) => `translated:${key}:${opts?.lng || 'en'}`),
  },
}));

import { i18nMiddleware } from '../../middleware/i18n';

function makeMocks(acceptLanguage = '') {
  const req = { headers: { 'accept-language': acceptLanguage } } as any;
  const res = {} as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('i18nMiddleware', () => {
  it('sets lang to en for no Accept-Language header', () => {
    const { req, res, next } = makeMocks();
    i18nMiddleware(req, res, next);

    expect(req.lang).toBe('en');
    expect(next).toHaveBeenCalled();
  });

  it('sets lang to ar for Arabic Accept-Language', () => {
    const { req, res, next } = makeMocks('ar');
    i18nMiddleware(req, res, next);

    expect(req.lang).toBe('ar');
  });

  it('sets lang to fr for French Accept-Language', () => {
    const { req, res, next } = makeMocks('fr-FR,fr;q=0.9');
    i18nMiddleware(req, res, next);

    expect(req.lang).toBe('fr');
  });

  it('falls back to en for unsupported language', () => {
    const { req, res, next } = makeMocks('zh-CN');
    i18nMiddleware(req, res, next);

    expect(req.lang).toBe('en');
  });

  it('attaches t function that calls i18n.t with correct locale', () => {
    const { req, res, next } = makeMocks('de');
    i18nMiddleware(req, res, next);

    expect(typeof req.t).toBe('function');
    const result = req.t('errors:some.key');
    expect(result).toContain('de');
  });

  it('always calls next()', () => {
    const { req, res, next } = makeMocks('es');
    i18nMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
