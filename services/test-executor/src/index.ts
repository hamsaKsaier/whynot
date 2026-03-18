import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes from './api/routes';
import { setupWebSocketServer } from './api/websocket-handler';
import { createLogger } from '../shared/logger/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const logger = createLogger('test-executor');

// Middleware
// CORS: This is an internal service called by the gateway. Restrict origins.
const testExecCorsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production'
    ? [] // In production, only allow gateway (same-network, no browser access)
    : ['http://localhost:3000', 'http://localhost:5183']);
app.use(cors({
  origin: testExecCorsOrigins.length > 0 ? testExecCorsOrigins : false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-ID'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Test Executor Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      execute_test: '/api/execute-test',
      detect_elements: '/api/detect-elements',
      capture_page: '/api/capture-page',
      get_results: '/api/results/:id',
      websocket: '/ws/browser-stream/:executionId'
    }
  });
});

// Setup WebSocket server
setupWebSocketServer(server);

server.listen(PORT, () => {
  logger.info('Test Executor Service started', {
    port: PORT,
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000'
  });
});

