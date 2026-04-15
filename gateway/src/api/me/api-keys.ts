import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';

const router = express.Router();
const logger = createLogger('me-api-keys');
const audit = new AuditRepository();

interface ApiKeyRow {
  id: string;
  user_id: string;
  label: string;
  key_hash: string;
  key_salt: string;
  last_four: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

const createKeySchema = z.object({
  label: z.string().min(1, 'Label is required').max(100),
});

const KEY_PREFIX = 'whynot_';

function generateApiKey(): string {
  return KEY_PREFIX + crypto.randomBytes(32).toString('hex');
}

function hashApiKey(plaintext: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + plaintext).digest('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/me/api-keys — list keys (never return full key)
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const keys = await query<ApiKeyRow>(
      `SELECT id, user_id, label, last_four, created_at, last_used_at
       FROM user_api_keys
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      keys: keys.map((k) => ({
        id: k.id,
        label: k.label,
        lastFour: k.last_four,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
    });
  })
);

// POST /api/me/api-keys — create a new API key
router.post(
  '/',
  requireAuth,
  validate(createKeySchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { label } = req.body;

    const plaintext = generateApiKey();
    const salt = generateSalt();
    const keyHash = hashApiKey(plaintext, salt);
    const lastFour = plaintext.slice(-4);

    const rows = await query<ApiKeyRow>(
      `INSERT INTO user_api_keys (user_id, label, key_hash, key_salt, last_four)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label, last_four, created_at, last_used_at`,
      [userId, label, keyHash, salt, lastFour]
    );

    const created = rows[0];

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'api-key.created',
      target_type: 'user_api_key',
      target_id: created.id,
      details: { label, lastFour },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('API key created', { userId, keyId: created.id, label });

    // Return plaintext ONCE — it will never be retrievable again
    res.status(201).json({
      id: created.id,
      label: created.label,
      key: plaintext,
      lastFour: created.last_four,
      createdAt: created.created_at,
      lastUsedAt: created.last_used_at,
    });
  })
);

// POST /api/me/api-keys/:id/rotate — revoke old key, generate new one
router.post(
  '/:id/rotate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Find existing key
    const existing = await query<ApiKeyRow>(
      'SELECT id, label FROM user_api_keys WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [id, userId]
    );

    if (existing.length === 0) {
      throw createError('API key not found', 404, 'NOT_FOUND');
    }

    const { label } = existing[0];

    // Revoke the old key
    await query(
      'UPDATE user_api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // Generate new key with the same label
    const plaintext = generateApiKey();
    const salt = generateSalt();
    const keyHash = hashApiKey(plaintext, salt);
    const lastFour = plaintext.slice(-4);

    const rows = await query<ApiKeyRow>(
      `INSERT INTO user_api_keys (user_id, label, key_hash, key_salt, last_four)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label, last_four, created_at, last_used_at`,
      [userId, label, keyHash, salt, lastFour]
    );

    const newKey = rows[0];

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'api-key.rotated',
      target_type: 'user_api_key',
      target_id: newKey.id,
      details: { label, previousKeyId: id, lastFour },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('API key rotated', { userId, oldKeyId: id, newKeyId: newKey.id });

    // Return plaintext ONCE — it will never be retrievable again
    res.status(201).json({
      id: newKey.id,
      label: newKey.label,
      key: plaintext,
      lastFour: newKey.last_four,
      createdAt: newKey.created_at,
      lastUsedAt: newKey.last_used_at,
      previousKeyId: id,
    });
  })
);

// DELETE /api/me/api-keys/:id — revoke a key
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await query<ApiKeyRow>(
      'SELECT id, label, last_four FROM user_api_keys WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [id, userId]
    );

    if (existing.length === 0) {
      throw createError('API key not found', 404, 'NOT_FOUND');
    }

    await query(
      'UPDATE user_api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'api-key.revoked',
      target_type: 'user_api_key',
      target_id: id,
      details: { label: existing[0].label, lastFour: existing[0].last_four },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('API key revoked', { userId, keyId: id });

    res.json({ success: true });
  })
);

export default router;
