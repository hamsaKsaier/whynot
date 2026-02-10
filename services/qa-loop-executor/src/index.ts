import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes from './api/routes';
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

export { server };
