import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes, { shutdownActiveSessions } from './api/routes';
import { setupWebSocketServer } from './api/websocket';
import perfRoutes from './api/perf-routes';
import { setupPerfWebSocketServer } from './api/perf-websocket';
import { stopAllK6Tests } from './perf/k6-runner';
import { createLogger } from '../../shared/logger/logger';
import { getPool } from '../../shared/database/connection';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3002;
const logger = createLogger('qa-loop-executor');

// Middleware
// CORS: This is an internal service called by the gateway. Restrict origins.
const qaLoopCorsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production'
    ? [] // In production, only allow gateway (same-network, no browser access)
    : ['http://localhost:3000', 'http://localhost:5183', 'http://localhost:5184']);
app.use(cors({
  origin: qaLoopCorsOrigins.length > 0 ? qaLoopCorsOrigins : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-ID', 'X-User-ID'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes — perf routes MUST be registered before the main routes because
// routes.ts mounts webhookRoutes at '/api' with authenticateAPIKey middleware
// that acts as a catch-all and would reject /api/perf/* with 401.
app.use('/', perfRoutes);
app.use('/', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'QA Loop Executor Service',
    version: '1.0.0',
    description: 'Autonomous QA exploration and testing powered by Claude',
    endpoints: {
      health: '/health',
      start_session: 'POST /api/sessions',
      get_session: 'GET /api/sessions/:id',
      list_sessions: 'GET /api/sessions',
      pause_session: 'POST /api/sessions/:id/pause',
      resume_session: 'POST /api/sessions/:id/resume',
      stop_session: 'POST /api/sessions/:id/stop',
      retest: 'POST /api/sessions/:id/retest',
      websocket: '/ws/qa-loop/:sessionId'
    }
  });
});

// Setup WebSocket servers (noServer mode — manually route upgrades)
const qaLoopWss = setupWebSocketServer(server);
const perfWss = setupPerfWebSocketServer(server);

// Route WebSocket upgrade requests to the correct server based on path
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/perf') {
    perfWss.handleUpgrade(request, socket, head, (ws) => {
      perfWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/qa-loop') {
    qaLoopWss.handleUpgrade(request, socket, head, (ws) => {
      qaLoopWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

/**
 * On startup, find any sessions that were left in the 'running' state by a
 * previous crash or ungraceful shutdown and mark them as 'failed' so they
 * don't appear stuck to the user and don't corrupt quality-score calculations.
 */
async function recoverStrandedSessions(): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query<{ id: string }>(`
      UPDATE qa_loop_sessions
         SET status          = 'failed',
             error_message   = 'Session interrupted by service restart',
             completed_at    = CURRENT_TIMESTAMP
       WHERE status = 'running'
      RETURNING id
    `);

    if (result.rows.length > 0) {
      logger.warn('Recovered stranded sessions from previous crash', {
        count: result.rows.length,
        sessionIds: result.rows.map(r => r.id)
      });
    } else {
      logger.info('No stranded sessions found on startup — clean state');
    }
  } catch (error: any) {
    // Non-fatal: if the DB isn't ready yet, log and continue
    logger.error('Failed to recover stranded sessions', { error: error.message });
  }
}

server.listen(PORT, async () => {
  // Fetch platform config at startup to determine available providers
  let anthropicConfigured = false;
  try {
    const { getPlatformConfig } = await import('./platform-config');
    const platformConfig = await getPlatformConfig();
    anthropicConfigured = platformConfig.providers.some(p => p.provider === 'anthropic' && p.apiKey);

    // Initialize model selector with platform config
    const { initModelSelector } = await import('./model-selector');
    await initModelSelector();
  } catch (error: any) {
    logger.warn('Failed to fetch platform AI config on startup', { error: error.message });
  }

  logger.info('QA Loop Executor Service started', {
    port: PORT,
    testExecutorUrl: process.env.TEST_EXECUTOR_URL || 'http://localhost:3001',
    anthropicConfigured,
  });

  // Recover any sessions that were left running by a crash
  await recoverStrandedSessions();
});

// ── Graceful shutdown (3.1) ────────────────────────────────────────────────────
// Stop all active orchestrators, update DB statuses, and close the HTTP server
// cleanly before the process exits so no session gets stuck in 'running' state.

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal} — starting graceful shutdown`);

  // Stop accepting new HTTP connections
  server.close(async () => {
    try {
      stopAllK6Tests();
      await shutdownActiveSessions();
      logger.info('All active sessions stopped cleanly');
    } catch (error: any) {
      logger.error('Error stopping sessions during shutdown', { error: error.message });
    }
    process.exit(0);
  });

  // Safety net: force-exit after 30 seconds if server.close() stalls
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30 s — forcing exit');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Log unhandled promise rejections so they don't silently swallow errors
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message ?? String(reason) });
});

export { server };
