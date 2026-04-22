import type { Request, Response, NextFunction } from 'express';
import acceptLanguage from 'accept-language-parser';
import i18n from '../i18n';

const SUPPORTED = ['en', 'ar', 'fr', 'de', 'es'];

export function i18nMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['accept-language'] ?? '';
  const lang = acceptLanguage.pick(SUPPORTED, header as string, { loose: true }) ?? 'en';
  (req as any).lang = lang;
  (req as any).t = (key: string, vars?: Record<string, unknown>) =>
    i18n.t(key, { ...vars, lng: lang });
  next();
}
