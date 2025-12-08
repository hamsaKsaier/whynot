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
app.use(cors());
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

