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
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  const monitors = await monitorRepository.findByWorkspace(workspaceId);

  // Strip sensitive login credentials
  const safe = monitors.map(m => ({
    ...m,
    login_credentials: m.login_credentials ? { configured: true } : null,
  }));

  res.json(safe);
}));

// Cron preview — returns human-readable text and next 3 run times
// NOTE: This must be defined before /:id routes to avoid matching "cron-preview" as an id
router.post('/cron-preview', requireAuth, asyncHandler(async (req: any, res) => {
  const { cron_expression } = req.body;
  if (!cron_expression || typeof cron_expression !== 'string') {
    return res.status(400).json({ error: (req as any).t('errors:validation.cronExpressionRequired') });
  }

  const parts = cron_expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return res.status(400).json({ error: (req as any).t('errors:validation.cronExpressionInvalid') });
  }

  const humanReadable = cronToHumanReadable(cron_expression);
  const nextRuns = getNextCronRuns(cron_expression, 3);

  res.json({ humanReadable, nextRuns: nextRuns.map(d => d.toISOString()) });
}));

// Create a monitor
router.post('/', requireAuth, validate(createMonitorSchema), asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

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
  if (!monitor) return res.status(404).json({ error: (req as any).t('errors:resource.monitorNotFound') });

  res.json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Update a monitor
router.put('/:id', requireAuth, validate(updateMonitorSchema), asyncHandler(async (req: any, res) => {
  const monitor = await monitorRepository.update(req.params.id, req.body);
  if (!monitor) return res.status(404).json({ error: (req as any).t('errors:resource.monitorNotFound') });

  logger.info('Monitor updated', { monitorId: monitor.id });

  res.json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Delete a monitor
router.delete('/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const deleted = await monitorRepository.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: (req as any).t('errors:resource.monitorNotFound') });
  res.json({ success: true });
}));

// Manually trigger a monitor
router.post('/:id/trigger', requireAuth, asyncHandler(async (req: any, res) => {
  try {
    const result = await triggerMonitorManually(req.params.id);
    res.json({ success: true, sessionId: result.sessionId, message: (req as any).t('success:monitor.triggered') });
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

// Pause a monitor
router.patch('/:id/pause', requireAuth, asyncHandler(async (req: any, res) => {
  const monitor = await monitorRepository.update(req.params.id, { is_enabled: false });
  if (!monitor) return res.status(404).json({ error: (req as any).t('errors:resource.monitorNotFound') });

  logger.info('Monitor paused', { monitorId: monitor.id, name: monitor.name });

  res.json({
    ...monitor,
    login_credentials: monitor.login_credentials ? { configured: true } : null,
  });
}));

// Resume a monitor
router.patch('/:id/resume', requireAuth, asyncHandler(async (req: any, res) => {
  const monitor = await monitorRepository.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: (req as any).t('errors:resource.monitorNotFound') });

  // Calculate next run time when resuming
  const nextRun = calculateNextRunFromCron(monitor.cron_expression);

  const updated = await monitorRepository.update(req.params.id, {
    is_enabled: true,
    next_run_at: nextRun,
  });

  logger.info('Monitor resumed', { monitorId: monitor.id, name: monitor.name, nextRun: nextRun?.toISOString() });

  res.json({
    ...updated,
    login_credentials: updated?.login_credentials ? { configured: true } : null,
  });
}));

// ── Cron utilities ──────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseCronFieldUtil(field: string, min: number, max: number): number[] {
  if (field === '*') return [];
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) values.push(i);
    } else if (part.includes('/')) {
      const [base, step] = part.split('/');
      const startVal = base === '*' ? min : parseInt(base, 10);
      const stepN = parseInt(step, 10);
      for (let i = startVal; i <= max; i += stepN) values.push(i);
    } else {
      const v = parseInt(part, 10);
      if (!isNaN(v)) values.push(v);
    }
  }
  return values.filter(v => v >= min && v <= max);
}

function formatTime12(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

function cronToHumanReadable(cron: string): string {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return cron;

    const [minuteF, hourF, domF, _monthF, dowF] = parts;
    const minutes = parseCronFieldUtil(minuteF, 0, 59);
    const hours = parseCronFieldUtil(hourF, 0, 23);
    const doms = parseCronFieldUtil(domF, 1, 31);
    const dows = parseCronFieldUtil(dowF, 0, 6);

    if (minuteF === '*' && hourF === '*') return 'Every minute';
    if (minuteF.startsWith('*/') && hourF === '*') {
      const step = parseInt(minuteF.split('/')[1], 10);
      return `Every ${step} minute${step !== 1 ? 's' : ''}`;
    }
    if (minuteF !== '*' && hourF.startsWith('*/')) {
      const step = parseInt(hourF.split('/')[1], 10);
      const min = minutes[0] ?? 0;
      return `Every ${step} hour${step !== 1 ? 's' : ''} at :${min.toString().padStart(2, '0')}`;
    }

    const hour = hours.length > 0 ? hours[0] : 0;
    const minute = minutes.length > 0 ? minutes[0] : 0;
    const timeStr = formatTime12(hour, minute);

    if (doms.length > 0 && dowF === '*') {
      const dayStr = doms.map(d => {
        const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
        return `${d}${suffix}`;
      }).join(', ');
      return `Monthly on the ${dayStr} at ${timeStr}`;
    }

    if (dows.length > 0) {
      if (dows.length === 5 && dows.every((d, i) => d === i + 1)) return `Weekdays at ${timeStr}`;
      if (dows.length === 7) return `Every day at ${timeStr}`;
      const dayNames = dows.map(d => DAY_NAMES[d]);
      if (dayNames.length === 1) return `Every ${dayNames[0]} at ${timeStr}`;
      const last = dayNames.pop();
      return `Every ${dayNames.join(', ')} and ${last} at ${timeStr}`;
    }

    if (hours.length > 0 && dowF === '*' && domF === '*') return `Every day at ${timeStr}`;
    if (hourF === '*' && minutes.length > 0) return `Every hour at :${minutes[0].toString().padStart(2, '0')}`;

    return cron;
  } catch {
    return cron;
  }
}

function getNextCronRuns(cron: string, count: number): Date[] {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return [];

    const [minuteF, hourF, domF, _monthF, dowF] = parts;
    const runs: Date[] = [];
    const now = new Date();
    const candidate = new Date(now);
    candidate.setSeconds(0);
    candidate.setMilliseconds(0);

    for (let attempt = 0; attempt < 1000 && runs.length < count; attempt++) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      const min = candidate.getMinutes();
      const hr = candidate.getHours();
      const dom = candidate.getDate();
      const dow = candidate.getDay();

      if (minuteF !== '*' && !parseCronFieldUtil(minuteF, 0, 59).includes(min)) continue;
      if (hourF !== '*' && !parseCronFieldUtil(hourF, 0, 23).includes(hr)) continue;
      if (domF !== '*' && !parseCronFieldUtil(domF, 1, 31).includes(dom)) continue;
      if (dowF !== '*' && !parseCronFieldUtil(dowF, 0, 6).includes(dow)) continue;

      runs.push(new Date(candidate));
    }
    return runs;
  } catch {
    return [];
  }
}

function calculateNextRunFromCron(cron: string): Date {
  const runs = getNextCronRuns(cron, 1);
  if (runs.length > 0) return runs[0];
  const fallback = new Date();
  fallback.setHours(fallback.getHours() + 24);
  return fallback;
}

export { router as monitorRouter };
