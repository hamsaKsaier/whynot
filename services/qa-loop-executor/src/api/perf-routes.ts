/**
 * perf-routes.ts
 *
 * API endpoints for performance testing.
 * Runs k6 tests and streams results via WebSocket.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../shared/logger/logger';
import { getPool } from '../../../shared/database/connection';
import { runK6Test, stopK6Test } from '../perf/k6-runner';
import { getPresetConfig, PerfTestConfig } from '../perf/k6-script-generator';
import { emitPerfMetric, emitPerfComplete, emitPerfError } from './perf-websocket';

const router = Router();
const logger = createLogger('perf-routes');

// ── Concurrent test tracking ─────────────────────────────────────────────────
const MAX_CONCURRENT_TESTS_PER_WORKSPACE = 2;
const runningTestsByWorkspace = new Map<string, Set<string>>();

function getRunningCount(workspaceId: string): number {
  return runningTestsByWorkspace.get(workspaceId)?.size ?? 0;
}
function trackRunning(workspaceId: string, runId: string): void {
  if (!runningTestsByWorkspace.has(workspaceId)) {
    runningTestsByWorkspace.set(workspaceId, new Set());
  }
  runningTestsByWorkspace.get(workspaceId)!.add(runId);
}
function untrackRunning(workspaceId: string, runId: string): void {
  const set = runningTestsByWorkspace.get(workspaceId);
  if (set) {
    set.delete(runId);
    if (set.size === 0) runningTestsByWorkspace.delete(workspaceId);
  }
}

// ── SSRF protection ──────────────────────────────────────────────────────────
function validateTargetUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'targetUrl must be a valid URL';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'targetUrl must use http or https';
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return 'targetUrl may not point to localhost';
  }

  // Block private IP ranges
  const privateRanges = [
    /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^127\./,
  ];
  if (privateRanges.some(r => r.test(host))) {
    return 'targetUrl may not point to a private network address';
  }

  // Block decimal IP notation
  if (/^\d+$/.test(host)) {
    return 'targetUrl may not use decimal IP notation';
  }

  // Block cloud metadata endpoints
  if (host === '169.254.169.254' || host === 'metadata.google.internal') {
    return 'targetUrl may not point to cloud metadata endpoints';
  }

  return null; // valid
}

// POST /api/perf/run — Start a performance test
router.post('/api/perf/run', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'X-Workspace-ID header is required' });
    }

    const {
      projectId,
      testType = 'load',
      targetUrl,
      method = 'POST',
      headers = {},
      body = {},
      config = {},
      thresholds = {},
      additionalRequests = [],
    } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    // SSRF validation
    const urlError = validateTargetUrl(targetUrl);
    if (urlError) {
      return res.status(400).json({ error: urlError });
    }

    // Validate additional request URLs too
    for (const addReq of additionalRequests) {
      if (addReq.url) {
        const addUrlError = validateTargetUrl(addReq.url);
        if (addUrlError) {
          return res.status(400).json({ error: `Additional request "${addReq.name}": ${addUrlError}` });
        }
      }
    }

    if (!['smoke', 'load', 'stress', 'spike'].includes(testType)) {
      return res.status(400).json({ error: 'testType must be smoke, load, stress, or spike' });
    }

    // Concurrent test limit
    if (getRunningCount(workspaceId) >= MAX_CONCURRENT_TESTS_PER_WORKSPACE) {
      return res.status(429).json({
        error: `Maximum ${MAX_CONCURRENT_TESTS_PER_WORKSPACE} concurrent tests per workspace. Wait for a running test to finish or stop it.`,
      });
    }

    const runId = uuidv4();
    const preset = getPresetConfig(testType);

    const stages = config.stages || preset.stages;
    const fullConfig: PerfTestConfig = {
      testType,
      targetUrl,
      method,
      headers,
      body,
      config: { ...config, stages },
      thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
      additionalRequests,
    };

    const pool = getPool();

    await pool.query(
      `INSERT INTO perf_test_runs (id, project_id, workspace_id, test_type, target_url, method, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'running')`,
      [runId, projectId || null, workspaceId, testType, targetUrl, method, JSON.stringify(fullConfig)],
    );

    trackRunning(workspaceId, runId);
    logger.info('Starting performance test', { runId, testType, targetUrl });

    res.json({
      success: true,
      runId,
      testType,
      targetUrl,
      preset: preset.description,
      wsPath: `/ws/perf?runId=${runId}`,
    });

    // Run k6 in background — do NOT await, response already sent
    runK6Test(runId, fullConfig, {
      onMetric: (metric) => {
        logger.debug('perf onMetric callback', { runId, requests: metric?.requests, vus: metric?.vus });
        emitPerfMetric(runId, metric);
      },
      onComplete: async (summary) => {
        untrackRunning(workspaceId, runId);
        try {
          await pool.query(
            `UPDATE perf_test_runs SET
              status = 'completed',
              completed_at = CURRENT_TIMESTAMP,
              duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
              total_requests = $2,
              failed_requests = $3,
              avg_response_time_ms = $4,
              p50_response_time_ms = $5,
              p90_response_time_ms = $6,
              p95_response_time_ms = $7,
              p99_response_time_ms = $8,
              max_response_time_ms = $9,
              min_response_time_ms = $10,
              requests_per_second = $11,
              raw_metrics = $12
            WHERE id = $1`,
            [
              runId,
              summary.totalRequests,
              summary.failedRequests,
              summary.avgResponseTimeMs,
              summary.p50ResponseTimeMs,
              summary.p90ResponseTimeMs,
              summary.p95ResponseTimeMs,
              summary.p99ResponseTimeMs,
              summary.maxResponseTimeMs,
              summary.minResponseTimeMs,
              summary.requestsPerSecond,
              JSON.stringify(summary),
            ],
          );
          emitPerfComplete(runId, summary);
          logger.info('Performance test completed', { runId });
        } catch (err: any) {
          logger.error('Failed to save perf results', { runId, error: err.message });
        }
      },
      onError: async (error) => {
        untrackRunning(workspaceId, runId);
        try {
          await pool.query(
            `UPDATE perf_test_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [runId],
          );
        } catch { /* ignore */ }
        emitPerfError(runId, error);
        logger.error('Performance test error', { runId, error });
      },
    }).catch((err) => {
      untrackRunning(workspaceId, runId);
      logger.error('K6 runner threw', { runId, error: err.message });
    });
  } catch (error: any) {
    logger.error('Failed to start perf test', { error: error.message });
    res.status(500).json({ error: 'Failed to start performance test', details: error.message });
  }
});

// POST /api/perf/stop/:id — Stop a running test
router.post('/api/perf/stop/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stopped = stopK6Test(id);
    const pool = getPool();

    if (stopped) {
      await pool.query(
        `UPDATE perf_test_runs SET status = 'stopped', completed_at = CURRENT_TIMESTAMP,
         duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000
         WHERE id = $1 AND status = 'running'`,
        [id],
      );
      res.json({ success: true, message: 'Test stopped' });
    } else {
      const result = await pool.query(
        `UPDATE perf_test_runs SET status = 'stopped', completed_at = CURRENT_TIMESTAMP,
         duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000
         WHERE id = $1 AND status = 'running' RETURNING id`,
        [id],
      );
      if (result.rows.length > 0) {
        res.json({ success: true, message: 'Test marked as stopped (process already exited)' });
      } else {
        res.json({ success: true, message: 'Test already completed' });
      }
    }
  } catch (error: any) {
    logger.error('Failed to stop perf test', { error: error.message });
    res.status(500).json({ error: 'Failed to stop test' });
  }
});

// GET /api/perf/runs — List past performance test runs
router.get('/api/perf/runs', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'X-Workspace-ID header is required' });
    }

    const { projectId, limit = '20', offset = '0' } = req.query;

    let query = `SELECT * FROM perf_test_runs WHERE workspace_id = $1`;
    const params: any[] = [workspaceId];
    let paramIdx = 2;

    if (projectId) {
      query += ` AND project_id = $${paramIdx}`;
      params.push(projectId);
      paramIdx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(Math.min(Number(limit) || 20, 50), Number(offset) || 0);

    const pool = getPool();
    const result = await pool.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM perf_test_runs WHERE workspace_id = $1`;
    const countParams: any[] = [workspaceId];
    if (projectId) {
      countQuery += ` AND project_id = $2`;
      countParams.push(projectId);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      runs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    logger.error('Failed to list perf runs', { error: error.message });
    res.status(500).json({ error: 'Failed to list performance test runs' });
  }
});

// GET /api/perf/runs/:id — Get detailed results
router.get('/api/perf/runs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query('SELECT * FROM perf_test_runs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Performance test run not found' });
    }

    res.json({ run: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to get perf run', { error: error.message });
    res.status(500).json({ error: 'Failed to get performance test run' });
  }
});

// GET /api/perf/presets — Get preset configurations
router.get('/api/perf/presets', (req: Request, res: Response) => {
  res.json({
    presets: {
      smoke: { ...getPresetConfig('smoke'), label: 'Smoke Test' },
      load: { ...getPresetConfig('load'), label: 'Load Test' },
      stress: { ...getPresetConfig('stress'), label: 'Stress Test' },
      spike: { ...getPresetConfig('spike'), label: 'Spike Test' },
    },
  });
});

export default router;
