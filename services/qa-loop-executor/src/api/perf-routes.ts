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
import { runK6Test, stopK6Test, isK6TestRunning } from '../perf/k6-runner';
import { getPresetConfig, PerfTestConfig } from '../perf/k6-script-generator';
import { emitPerfMetric, emitPerfComplete, emitPerfError } from './perf-websocket';

const router = Router();
const logger = createLogger('perf-routes');

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

    if (!['smoke', 'load', 'stress', 'spike'].includes(testType)) {
      return res.status(400).json({ error: 'testType must be smoke, load, stress, or spike' });
    }

    const runId = uuidv4();
    const preset = getPresetConfig(testType);

    // Build full config — merge user overrides with preset
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

    // Insert run record
    await pool.query(
      `INSERT INTO perf_test_runs (id, project_id, workspace_id, test_type, target_url, method, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'running')`,
      [runId, projectId || null, workspaceId, testType, targetUrl, method, JSON.stringify(fullConfig)],
    );

    logger.info('Starting performance test', { runId, testType, targetUrl });

    // Return immediately — test runs in background
    res.json({
      success: true,
      runId,
      testType,
      targetUrl,
      preset: preset.description,
      wsPath: `/ws/perf?runId=${runId}`,
    });

    // Run k6 in background
    runK6Test(runId, fullConfig, {
      onMetric: (metric) => {
        emitPerfMetric(runId, metric);
      },
      onComplete: async (summary) => {
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
      // Process already exited — update DB if still marked running
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
    params.push(Number(limit), Number(offset));

    const pool = getPool();
    const result = await pool.query(query, params);

    // Get total count
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
