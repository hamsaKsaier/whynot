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
import { ExportService } from '../../services/export-service';
import { existsSync } from 'fs';

const router = express.Router();
const logger = createLogger('me-account');
const userRepo = new UserRepository();
const audit = new AuditRepository();

const exportSchema = z.object({
  format: z.enum(['json', 'csv']),
});

const deleteSchema = z.object({
  password: z.string().min(1, 'Password is required').max(128),
});

// POST /api/me/account/export — request data export
router.post(
  '/export',
  requireAuth,
  validate(exportSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { format } = req.body;

    // Create an export request record
    const rows = await query<{ id: string; status: string; created_at: Date }>(
      `INSERT INTO data_export_requests (user_id, format, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, status, created_at`,
      [userId, format]
    );

    const exportRequest = rows[0];

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'account.export-requested',
      target_type: 'user',
      target_id: userId,
      details: { format, exportRequestId: exportRequest.id },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Data export requested', { userId, format, exportRequestId: exportRequest.id });

    const workspaceId = (req as any).workspaceId;
    ExportService.processExport(exportRequest.id, userId, workspaceId).catch((err) => {
      logger.error('Background export failed', { exportId: exportRequest.id, error: (err as Error).message });
    });

    res.status(202).json({
      id: exportRequest.id,
      status: exportRequest.status,
      format,
      message: 'Export request queued. You will be notified when the export is ready.',
      createdAt: exportRequest.created_at,
    });
  })
);

// GET /api/me/account/export/:id — poll export status
router.get(
  '/export/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const exportId = req.params.id;

    const rows = await query<{ id: string; status: string; download_url: string | null; created_at: Date; completed_at: Date | null }>(
      `SELECT id, status, download_url, created_at, completed_at
       FROM data_export_requests
       WHERE id = $1 AND user_id = $2`,
      [exportId, userId],
    );

    if (rows.length === 0) {
      throw createError('Export not found', 404, 'NOT_FOUND');
    }

    const row = rows[0];
    res.json({
      id: row.id,
      status: row.status,
      downloadUrl: row.download_url,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    });
  })
);

// GET /api/me/account/export/:id/download — download completed export ZIP
router.get(
  '/export/:id/download',
  asyncHandler(async (req, res) => {
    const exportId = req.params.id;
    const token = req.query.token as string;

    if (!token || !ExportService.validateToken(token, exportId)) {
      throw createError('Invalid or expired download link', 403, 'INVALID_TOKEN');
    }

    const filePath = ExportService.getExportFilePath(exportId);
    if (!existsSync(filePath)) {
      throw createError('Export file not found', 404, 'FILE_NOT_FOUND');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="whynot-export-${exportId.slice(0, 8)}.zip"`);
    res.sendFile(filePath, () => {
      ExportService.cleanup(exportId, token);
    });
  })
);

// POST /api/me/account/delete — request account deletion (soft delete with 7-day grace)
router.post(
  '/delete',
  requireAuth,
  validate(deleteSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { password } = req.body;

    const user = await userRepo.findById(userId);
    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    if (!user.password_hash) {
      throw createError(
        'Account deletion with password not available for OAuth accounts. Please contact support.',
        400,
        'NO_PASSWORD'
      );
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw createError('Password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // Check if already scheduled for deletion
    const existingDeletion = await query<{ deleted_at: Date }>(
      'SELECT deleted_at FROM users WHERE id = $1 AND deleted_at IS NOT NULL',
      [userId]
    );

    if (existingDeletion.length > 0) {
      throw createError(
        'Account is already scheduled for deletion',
        409,
        'ALREADY_SCHEDULED'
      );
    }

    // Set deleted_at to now — actual purge happens after 7-day grace period
    const deletedAt = new Date().toISOString();
    await query(
      'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId]
    );

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'account.deletion-requested',
      target_type: 'user',
      target_id: userId,
      details: { gracePeriodDays: 7 },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('Account deletion requested', { userId });

    res.json({
      success: true,
      message: 'Account scheduled for deletion. You have 7 days to cancel this action by logging in.',
      deletedAt,
      gracePeriodDays: 7,
    });
  })
);

export default router;
