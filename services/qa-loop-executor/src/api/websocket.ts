import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '../../../shared/logger/logger';
import { URL } from 'url';

const logger = createLogger('qa-loop-websocket');

// Map of session ID to connected clients
const sessionClients = new Map<string, Set<WebSocket>>();

// Map of session ID to event queues (for events before client connects)
const sessionEventQueues = new Map<string, QALoopEvent[]>();

export interface QALoopEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'progress' | 'error' |
  'iteration_start' | 'iteration_end' | 'page_discovered' | 'page_explored' |
  'test_generated' | 'bug_found' | 'session_complete' | 'connected' |
  'screenshot' | 'status_update';
  data: any;
  timestamp: string;
}

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/qa-loop'
  });

  wss.on('connection', (ws: WebSocket, req) => {
    // Extract session ID from URL query parameter
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      logger.warn('WebSocket connection without sessionId');
      ws.close(1008, 'sessionId query parameter required');
      return;
    }

    logger.info('WebSocket client connected', { sessionId });

    // Add client to session's client set
    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId)!.add(ws);

    // Send connected confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      data: { sessionId },
      timestamp: new Date().toISOString()
    }));

    // Send any queued events
    const queuedEvents = sessionEventQueues.get(sessionId) || [];
    for (const event of queuedEvents) {
      ws.send(JSON.stringify(event));
    }
    sessionEventQueues.delete(sessionId);

    // Handle client messages
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug('Received message from client', { sessionId, type: data.type });

        // Handle any client commands if needed
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message', { error });
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      logger.info('WebSocket client disconnected', { sessionId });
      const clients = sessionClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          sessionClients.delete(sessionId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { sessionId, error: error.message });
    });
  });

  logger.info('WebSocket server initialized', { path: '/ws/qa-loop' });
  return wss;
}

/**
 * Emit an event to all clients connected to a session
 */
export function emitToSession(sessionId: string, event: Omit<QALoopEvent, 'timestamp'>): void {
  const fullEvent: QALoopEvent = {
    ...event,
    timestamp: new Date().toISOString()
  };

  const clients = sessionClients.get(sessionId);

  if (!clients || clients.size === 0) {
    // Queue event for when client connects
    if (!sessionEventQueues.has(sessionId)) {
      sessionEventQueues.set(sessionId, []);
    }
    const queue = sessionEventQueues.get(sessionId)!;
    queue.push(fullEvent);

    // Limit queue size to prevent memory issues
    if (queue.length > 1000) {
      queue.shift();
    }
    return;
  }

  const eventString = JSON.stringify(fullEvent);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(eventString);
      } catch (error) {
        logger.error('Error sending event to client', { sessionId, error });
      }
    }
  }
}

/**
 * Check if any clients are connected to a session
 */
export function hasConnectedClients(sessionId: string): boolean {
  const clients = sessionClients.get(sessionId);
  return clients ? clients.size > 0 : false;
}

/**
 * Get count of connected clients for a session
 */
export function getClientCount(sessionId: string): number {
  const clients = sessionClients.get(sessionId);
  return clients ? clients.size : 0;
}

/**
 * Clean up resources for a session
 */
export function cleanupSession(sessionId: string): void {
  sessionEventQueues.delete(sessionId);
  const clients = sessionClients.get(sessionId);
  if (clients) {
    for (const client of clients) {
      client.close(1000, 'Session ended');
    }
    sessionClients.delete(sessionId);
  }
}
