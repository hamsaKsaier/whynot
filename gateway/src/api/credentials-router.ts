/**
 * credentials-router.ts
 *
 * CRUD endpoints for project test credentials and user notification preferences.
 *
 * Project credentials:
 *   POST   /api/projects/:projectId/credentials    — save encrypted credentials
 *   GET    /api/projects/:projectId/credentials    — check if credentials exist
 *   DELETE /api/projects/:projectId/credentials    — remove credentials
 *
 * Notification preferences:
 *   GET    /api/notifications/preferences          — get user's preferences
 *   PUT    /api/notifications/preferences          — update a preference
 */

import express from 'express';
import crypto from 'crypto';
import { asyncHandler, createError } from '../middleware/error-handler';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';

const router = express.Router();
const logger = createLogger('credentials-router');

// ── Encryption (same pattern as integrations-router.ts) ──────────────────────

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// ── Project Credential Endpoints ─────────────────────────────────────────────

// POST /api/projects/:projectId/credentials — save credentials
router.post('/projects/:projectId/credentials', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { username, password } = req.body;

  if (!username || !password) {
    throw createError('username and password are required', 400, 'VALIDATION_ERROR');
  }

  const encryptedUsername = encrypt(username);
  const encryptedPassword = encrypt(password);

  await query(
    `INSERT INTO project_credentials (project_id, encrypted_username, encrypted_password)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id) DO UPDATE
     SET encrypted_username = $2, encrypted_password = $3, updated_at = NOW()`,
    [projectId, encryptedUsername, encryptedPassword],
  );

  logger.info('Project credentials saved', { projectId });
  res.json({ success: true });
}));

// GET /api/projects/:projectId/credentials — check existence
router.get('/projects/:projectId/credentials', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const rows = await query<{ id: string }>(
    'SELECT id FROM project_credentials WHERE project_id = $1',
    [projectId],
  );

  res.json({ hasCredentials: rows.length > 0 });
}));

// DELETE /api/projects/:projectId/credentials — remove credentials
router.delete('/projects/:projectId/credentials', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  await query('DELETE FROM project_credentials WHERE project_id = $1', [projectId]);

  logger.info('Project credentials deleted', { projectId });
  res.json({ success: true });
}));

// ── Notification Preference Endpoints ────────────────────────────────────────

const VALID_TRIGGERS = ['scan_complete', 'critical_bug', 'monitor_alert', 'autofix_pr'] as const;

// GET /api/notifications/preferences — get all preferences for current user
router.get('/notifications/preferences', asyncHandler(async (req, res) => {
  const userId = req.user!.id;

  const rows = await query<{ trigger_type: string; enabled: boolean }>(
    `SELECT trigger_type, enabled FROM notification_preferences
     WHERE user_id = $1 AND channel = 'email'`,
    [userId],
  );

  // Build a map with defaults (all enabled)
  const prefs: Record<string, boolean> = {};
  for (const t of VALID_TRIGGERS) {
    prefs[t] = true; // default
  }
  for (const row of rows) {
    prefs[row.trigger_type] = row.enabled;
  }

  res.json({ preferences: prefs });
}));

// PUT /api/notifications/preferences — update a single preference
router.put('/notifications/preferences', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { trigger_type, enabled } = req.body;

  if (!trigger_type || !VALID_TRIGGERS.includes(trigger_type)) {
    throw createError(`trigger_type must be one of: ${VALID_TRIGGERS.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  if (typeof enabled !== 'boolean') {
    throw createError('enabled must be a boolean', 400, 'VALIDATION_ERROR');
  }

  await query(
    `INSERT INTO notification_preferences (user_id, trigger_type, channel, enabled)
     VALUES ($1, $2, 'email', $3)
     ON CONFLICT (user_id, trigger_type, channel) DO UPDATE
     SET enabled = $3`,
    [userId, trigger_type, enabled],
  );

  res.json({ success: true });
}));

export { router as credentialsRouter };
