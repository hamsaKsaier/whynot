import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes, { shutdownActiveSessions } from './api/routes';
import { setupWebSocketServer } from './api/websocket';
import { createLogger } from '../../shared/logger/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3002;
const logger = createLogger('qa-loop-executor');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
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

// Setup WebSocket server for real-time streaming
setupWebSocketServer(server);

server.listen(PORT, () => {
  logger.info('QA Loop Executor Service started', {
    port: PORT,
    testExecutorUrl: process.env.TEST_EXECUTOR_URL || 'http://localhost:3001',
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
  });
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
