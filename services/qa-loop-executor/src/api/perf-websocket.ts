/**
 * perf-websocket.ts
 *
 * WebSocket support for real-time performance test metric streaming.
 * Reuses the existing HTTP server and adds a /ws/perf path.
 */

import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '../../../shared/logger/logger';
import { URL } from 'url';

const logger = createLogger('perf-websocket');

// Map of runId → connected clients
const perfClients = new Map<string, Set<WebSocket>>();

// Event queue for metrics before client connects
const perfEventQueues = new Map<string, any[]>();

export function setupPerfWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/perf',
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const runId = url.searchParams.get('runId');

    if (!runId) {
      ws.close(1008, 'runId query parameter required');
      return;
    }

    logger.info('Perf WebSocket client connected', { runId });

    if (!perfClients.has(runId)) {
      perfClients.set(runId, new Set());
    }
    perfClients.get(runId)!.add(ws);

    // Send connected confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      data: { runId },
      timestamp: new Date().toISOString(),
    }));

    // Send queued events
    const queued = perfEventQueues.get(runId) || [];
    for (const event of queued) {
      ws.send(JSON.stringify(event));
    }
    perfEventQueues.delete(runId);

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      logger.info('Perf WebSocket client disconnected', { runId });
      const clients = perfClients.get(runId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          perfClients.delete(runId);
        }
      }
    });

    ws.on('error', (error) => {
      logger.error('Perf WebSocket error', { runId, error: error.message });
    });
  });

  logger.info('Perf WebSocket server initialized', { path: '/ws/perf' });
  return wss;
}

function emitToRun(runId: string, event: any): void {
  const fullEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const clients = perfClients.get(runId);
  if (!clients || clients.size === 0) {
    // Queue events for late-connecting clients
    if (!perfEventQueues.has(runId)) {
      perfEventQueues.set(runId, []);
    }
    const queue = perfEventQueues.get(runId)!;
    queue.push(fullEvent);
    if (queue.length > 500) queue.shift();
    return;
  }

  const eventString = JSON.stringify(fullEvent);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(eventString);
      } catch (error) {
        logger.error('Error sending perf event', { runId, error });
      }
    }
  }
}

export function emitPerfMetric(runId: string, metric: any): void {
  emitToRun(runId, { type: 'perf_metric', data: metric });
}

export function emitPerfComplete(runId: string, summary: any): void {
  emitToRun(runId, { type: 'perf_complete', data: summary });
  // Cleanup after a long delay to ensure late-connecting clients get final results
  setTimeout(() => {
    perfEventQueues.delete(runId);
    const clients = perfClients.get(runId);
    if (clients) {
      for (const client of clients) {
        client.close(1000, 'Test completed');
      }
      perfClients.delete(runId);
    }
  }, 60_000);
}

export function emitPerfError(runId: string, error: string): void {
  emitToRun(runId, { type: 'perf_error', data: { error } });
}
