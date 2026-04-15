import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import { query } from '../../../shared/database/connection';

const router = express.Router();
const logger = createLogger('me-notifications');
const audit = new AuditRepository();

interface NotificationPrefRow {
  id: string;
  user_id: string;
  trigger_type: string;
  channel: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// Map frontend keys to database trigger_type values
const TRIGGER_TYPE_MAP: Record<string, string> = {
  productUpdates: 'product_updates',
  billing: 'billing',
  security: 'security',
  scanComplete: 'scan_complete',
  criticalBug: 'critical_bug',
  monitorAlert: 'monitor_alert',
};

const TRIGGER_TYPES = Object.keys(TRIGGER_TYPE_MAP);

// Reverse map: database trigger_type -> frontend key
const REVERSE_TRIGGER_MAP: Record<string, string> = Object.entries(TRIGGER_TYPE_MAP).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<string, string>
);

const updateNotificationsSchema = z.object({
  productUpdates: z.boolean().optional(),
  billing: z.boolean().optional(),
  security: z.boolean().optional(),
  scanComplete: z.boolean().optional(),
  criticalBug: z.boolean().optional(),
  monitorAlert: z.boolean().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one notification preference must be provided' }
);

function rowsToResponse(rows: NotificationPrefRow[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  // Initialize all known triggers to default (true for security/criticalBug, false for others)
  const defaults: Record<string, boolean> = {
    productUpdates: false,
    billing: true,
    security: true,
    scanComplete: false,
    criticalBug: true,
    monitorAlert: false,
  };

  for (const [key, defaultVal] of Object.entries(defaults)) {
    result[key] = defaultVal;
  }

  // Override with actual database values
  for (const row of rows) {
    const frontendKey = REVERSE_TRIGGER_MAP[row.trigger_type];
    if (frontendKey) {
      result[frontendKey] = row.enabled;
    }
  }

  return result;
}

// GET /api/me/notifications — return notification preferences
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const rows = await query<NotificationPrefRow>(
      `SELECT id, user_id, trigger_type, channel, enabled, created_at, updated_at
       FROM notification_preferences
       WHERE user_id = $1 AND channel = 'email'
       ORDER BY trigger_type ASC`,
      [userId]
    );

    res.json({ preferences: rowsToResponse(rows) });
  })
);

// PATCH /api/me/notifications — update notification preferences
router.patch(
  '/',
  requireAuth,
  validate(updateNotificationsSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const updates = req.body as Record<string, boolean>;

    const changedKeys: string[] = [];

    for (const [frontendKey, enabled] of Object.entries(updates)) {
      if (enabled === undefined) continue;

      const triggerType = TRIGGER_TYPE_MAP[frontendKey];
      if (!triggerType) continue;

      changedKeys.push(frontendKey);

      // Upsert: insert or update the preference
      await query(
        `INSERT INTO notification_preferences (user_id, trigger_type, channel, enabled)
         VALUES ($1, $2, 'email', $3)
         ON CONFLICT (user_id, trigger_type, channel)
         DO UPDATE SET enabled = $3, updated_at = NOW()`,
        [userId, triggerType, enabled]
      );
    }

    // Fetch all preferences to return the complete state
    const rows = await query<NotificationPrefRow>(
      `SELECT id, user_id, trigger_type, channel, enabled, created_at, updated_at
       FROM notification_preferences
       WHERE user_id = $1 AND channel = 'email'
       ORDER BY trigger_type ASC`,
      [userId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'notifications.updated',
      target_type: 'user',
      target_id: userId,
      details: { changedKeys },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Notification preferences updated', { userId, changedKeys });

    res.json({ preferences: rowsToResponse(rows) });
  })
);

export default router;
