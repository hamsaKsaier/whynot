/**
 * monitor-router.ts
 *
 * CRUD routes for QA Monitors (scheduled recurring QA scans).
 * All routes require authentication.
 */

import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error-handler';
import { validate } from '../middleware/validation';
import { QAMonitorRepository } from '../../shared/database/repositories/qa-monitor-repository';
import { triggerMonitorManually } from '../services/qa-monitor-scheduler';
import { createLogger } from '../../shared/logger/logger';

const router = express.Router();
const logger = createLogger('monitor-router');
const monitorRepository = new QAMonitorRepository();

// ── Schemas ──────────────────────────────────────────────────────────────────

const createMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  target_url: z.string().url('Must be a valid URL'),
  cron_expression: z.string().min(1, 'Cron expression is required').max(100),
  quality_threshold: z.number().min(0).max(100).optional().default(80),
  max_iterations: z.number().int().min(1).max(100).optional().default(5),
  notify_on_failure: z.boolean().optional().default(true),
  notify_on_regression: z.boolean().optional().default(true),
  login_credentials: z.any().optional(),
  document_context: z.string().max(50_000).optional(),
});

const updateMonitorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  target_url: z.string().url().optional(),
  cron_expression: z.string().min(1).max(100).optional(),
  quality_threshold: z.number().min(0).max(100).optional(),
  max_iterations: z.number().int().min(1).max(100).optional(),
  is_enabled: z.boolean().optional(),
  notify_on_failure: z.boolean().optional(),
  notify_on_regression: z.boolean().optional(),
  login_credentials: z.any().optional(),
  document_context: z.string().max(50_000).optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

// List monitors for workspace
router.get('/', requireAuth, asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace required' });

  const monitors = await monitorRepository.findByWorkspace(workspaceId);

  // Strip sensitive login credentials
  const safe = monitors.map(m => ({
    ...m,
    login_credentials: m.login_credentials ? { configured: true } : null,
  }));

  res.json(safe);
}));

// Create a monitor
router.post('/', requireAuth, validate(createMonitorSchema), asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace required' });

  const monitor = await monitorRepository.create({
    ...req.body,
    workspace_id: workspaceId,
  });

  logger.info('Monitor created', { monitorId: monitor.id, name: monitor.name });

  res.status(201).json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Get a monitor
router.get('/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const monitor = await monitorRepository.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

  res.json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Update a monitor
router.put('/:id', requireAuth, validate(updateMonitorSchema), asyncHandler(async (req: any, res) => {
  const monitor = await monitorRepository.update(req.params.id, req.body);
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

  logger.info('Monitor updated', { monitorId: monitor.id });

  res.json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Delete a monitor
router.delete('/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const deleted = await monitorRepository.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Monitor not found' });
  res.json({ success: true });
}));

// Manually trigger a monitor
router.post('/:id/trigger', requireAuth, asyncHandler(async (req: any, res) => {
  try {
    const result = await triggerMonitorManually(req.params.id);
    res.json({ success: true, sessionId: result.sessionId, message: 'Monitor triggered' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}));

// Get monitor history (recent sessions)
router.get('/:id/history', requireAuth, asyncHandler(async (req: any, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const history = await monitorRepository.getHistory(req.params.id, limit);
  res.json(history);
}));

export { router as monitorRouter };
