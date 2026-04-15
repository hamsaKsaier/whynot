import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { UserRepository } from '../../../shared/database/repositories/user-repository';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';

const router = express.Router();
const logger = createLogger('me-profile');
const userRepo = new UserRepository();
const audit = new AuditRepository();

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined, {
  message: 'At least one field (name or email) must be provided',
});

// GET /api/me/profile — return current user profile
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const user = await userRepo.findById(userId);

    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  })
);

// PATCH /api/me/profile — update name and/or email
router.patch(
  '/',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { name, email } = req.body;

    // If updating email, check for uniqueness
    if (email) {
      const existing = await userRepo.findByEmail(email);
      if (existing && existing.id !== userId) {
        throw createError('Email already in use', 409, 'EMAIL_TAKEN');
      }
    }

    const updates: { name?: string; email?: string } = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;

    const updated = await userRepo.update(userId, updates);

    if (!updated) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    const changedFields = Object.keys(updates);
    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'profile.updated',
      target_type: 'user',
      target_id: userId,
      details: { changedFields },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Profile updated', { userId, changedFields });

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatar_url,
      role: updated.role,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  })
);

export default router;
