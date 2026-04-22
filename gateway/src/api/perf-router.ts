/**
 * perf-router.ts
 *
 * Gateway proxy for performance testing endpoints.
 * Forwards requests to the qa-loop-executor service.
 */

import express from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/error-handler';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';

const router = express.Router();
const logger = createLogger('perf-router');

const qaLoopExecutorUrl = env.QA_LOOP_EXECUTOR_URL;

function perfHeaders(req: express.Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (req.workspaceId) headers['X-Workspace-ID'] = req.workspaceId;
  if (req.user?.id)   headers['X-User-ID']       = req.user.id;
  return headers;
}

function forwardError(error: any, label: string, req: express.Request, res: express.Response): void {
  logger.error(`Perf proxy error: ${label}`, {
    message: error.message,
    status: error.response?.status,
  });
  if (error.response) {
    // Never forward 401/403 from upstream — auth is handled by the gateway's
    // requireAuth middleware. Forwarding upstream 401 would trigger the
    // frontend's logout interceptor and log the user out incorrectly.
    const status = error.response.status;
    const safeStatus = (status === 401 || status === 403) ? 502 : status;
    res.status(safeStatus).json({
      error: label,
      details: error.response.data?.error || error.response.data || 'Upstream error',
    });
  } else {
    res.status(502).json({ error: label, details: (req as any).t('errors:service.perfTestUnavailable') });
  }
}

// POST /run — Start a performance test
router.post('/run', asyncHandler(async (req, res) => {
  try {
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/perf/run`,
      req.body,
      { headers: perfHeaders(req), timeout: 30000 },
    );
    res.json(response.data);
  } catch (error: any) {
    forwardError(error, 'Failed to start performance test', req, res);
  }
}));

// POST /stop/:id — Stop a running test
router.post('/stop/:id', asyncHandler(async (req, res) => {
  try {
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/perf/stop/${req.params.id}`,
      {},
      { headers: perfHeaders(req), timeout: 10000 },
    );
    res.json(response.data);
  } catch (error: any) {
    forwardError(error, 'Failed to stop performance test', req, res);
  }
}));

// GET /runs — List past runs
router.get('/runs', asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/perf/runs`,
      {
        headers: perfHeaders(req),
        params: req.query,
        timeout: 10000,
      },
    );
    res.json(response.data);
  } catch (error: any) {
    forwardError(error, 'Failed to list performance runs', req, res);
  }
}));

// GET /runs/:id — Get run details
router.get('/runs/:id', asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/perf/runs/${req.params.id}`,
      { headers: perfHeaders(req), timeout: 10000 },
    );
    res.json(response.data);
  } catch (error: any) {
    forwardError(error, 'Failed to get performance run', req, res);
  }
}));

// GET /presets — Get preset configurations
router.get('/presets', asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/perf/presets`,
      { headers: perfHeaders(req), timeout: 10000 },
    );
    res.json(response.data);
  } catch (error: any) {
    forwardError(error, 'Failed to get presets', req, res);
  }
}));

export { router as perfRouter };
