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

const router = express.Router();
const logger = createLogger('perf-router');

const qaLoopExecutorUrl =
  process.env.QA_LOOP_EXECUTOR_URL || 'http://localhost:3002';

function perfHeaders(req: express.Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (req.workspaceId) headers['X-Workspace-ID'] = req.workspaceId;
  if (req.user?.id)   headers['X-User-ID']       = req.user.id;
  return headers;
}

function forwardError(error: any, label: string, res: express.Response): void {
  logger.error(`Perf proxy error: ${label}`, {
    message: error.message,
    status: error.response?.status,
  });
  if (error.response) {
    res.status(error.response.status).json(error.response.data);
  } else {
    res.status(500).json({ error: label, details: 'Service unavailable' });
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
    forwardError(error, 'Failed to start performance test', res);
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
    forwardError(error, 'Failed to stop performance test', res);
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
    forwardError(error, 'Failed to list performance runs', res);
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
    forwardError(error, 'Failed to get performance run', res);
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
    forwardError(error, 'Failed to get presets', res);
  }
}));

export { router as perfRouter };
