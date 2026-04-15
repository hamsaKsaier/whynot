import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';

const router = express.Router();
const logger = createLogger('me-language');
const audit = new AuditRepository();

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const updateLanguageSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    error: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
  }),
});

// PATCH /api/me/language — update user's preferred language
router.patch(
  '/',
  requireAuth,
  validate(updateLanguageSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { language } = req.body as { language: SupportedLanguage };

    const rows = await query<{ id: string; preferred_language: string }>(
      `UPDATE users SET preferred_language = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, preferred_language`,
      [language, userId]
    );

    if (rows.length === 0) {
      throw createError((req as any).t('errors:resource.userNotFound'), 404, 'NOT_FOUND');
    }

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'language.updated',
      target_type: 'user',
      target_id: userId,
      details: { language },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Language preference updated', { userId, language });

    res.json({
      language: rows[0].preferred_language,
    });
  })
);

export default router;
