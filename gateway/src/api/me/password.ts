import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { UserRepository } from '../../../shared/database/repositories/user-repository';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';

const router = express.Router();
const logger = createLogger('me-password');
const userRepo = new UserRepository();
const audit = new AuditRepository();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters'),
});

// POST /api/me/password — change password
router.post(
  '/',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await userRepo.findById(userId);
    if (!user) {
      throw createError((req as any).t('errors:resource.userNotFound'), 404, 'NOT_FOUND');
    }

    if (!user.password_hash) {
      throw createError(
        (req as any).t('errors:auth.passwordNotAvailableOAuth'),
        400,
        'NO_PASSWORD'
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw createError((req as any).t('errors:auth.passwordIncorrect'), 401, 'INVALID_PASSWORD');
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'password.changed',
      target_type: 'user',
      target_id: userId,
      details: {},
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Password changed', { userId });

    res.json({ success: true, message: (req as any).t('success:password.updated') });
  })
);

export default router;
