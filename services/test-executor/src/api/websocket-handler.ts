import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BrowserStreamer } from '../infrastructure/browser/browser-streamer';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('websocket-handler');

// Store active streams by execution ID
const activeStreams = new Map<string, BrowserStreamer>();
// Store pending WebSocket connections waiting for streamer
const pendingConnections = new Map<string, WebSocket>();

/**
 * Setup WebSocket server for browser streaming
 */
export function setupWebSocketServer(server: any): void {
  // Create WebSocket server without path restriction to handle dynamic paths
  const wss = new WebSocketServer({ 
    server,
    // Don't restrict path - we'll handle routing in the connection handler
    verifyClient: (info: any) => {
      // Allow all connections, we'll validate the path in the connection handler
      return true;
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract execution ID from URL path like /ws/browser-stream/:executionId
    let executionId = '';
    const url = req.url || '';
    
    logger.debug('WebSocket connection attempt', { url, headers: req.headers });
    
    // Try to match the path pattern
    const pathMatch = url.match(/\/ws\/browser-stream\/([^\/\?]+)/);
    if (pathMatch) {
      executionId = pathMatch[1];
    } else {
      // Also check if executionId is in query params as fallback
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        executionId = urlObj.searchParams.get('executionId') || '';
      } catch (e) {
        // URL parsing failed, try direct path extraction
        const parts = url.split('/');
        const wsIndex = parts.indexOf('ws');
        const streamIndex = parts.indexOf('browser-stream');
        if (streamIndex !== -1 && streamIndex + 1 < parts.length) {
          executionId = parts[streamIndex + 1].split('?')[0];
        }
      }
    }

    if (!executionId) {
      logger.warn('WebSocket connection without execution ID', { url, method: req.method });
      ws.close(1008, 'Execution ID required');
      return;
    }

    logger.info('WebSocket connection established', { executionId });

    // Check if streamer already exists
    const streamer = activeStreams.get(executionId);
    if (streamer) {
      // Attach WebSocket to existing streamer
      // attachWebSocket will call startStreaming() if not already started
      streamer.attachWebSocket(ws);
      logger.info('WebSocket attached to existing streamer', { executionId });
    } else {
      // Store connection for later attachment
      pendingConnections.set(executionId, ws);
      logger.info('WebSocket connection stored, waiting for streamer', { executionId });
      
      // Send immediate confirmation to keep connection alive
      try {
        ws.send(JSON.stringify({ 
          type: 'connected', 
          executionId,
          message: 'Waiting for browser stream to start...' 
        }));
      } catch (error: any) {
        logger.warn('Failed to send initial connected message', { error: error.message, executionId });
      }
    }

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug('WebSocket message received', { executionId, type: data.type });
        
        // Handle different message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error: any) {
        logger.error('Error processing WebSocket message', error);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.info('WebSocket connection closed', { 
        executionId, 
        code, 
        reason: reason.toString(),
        hasStreamer: !!activeStreams.get(executionId),
        wasPending: pendingConnections.has(executionId)
      });
      pendingConnections.delete(executionId);
      // Don't cleanup streamer here - it will be cleaned up when test completes
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error in handler', { 
        executionId, 
        error: error.message,
        readyState: ws.readyState,
        hasStreamer: !!activeStreams.get(executionId),
        wasPending: pendingConnections.has(executionId)
      });
    });

    // Send connection confirmation (only if streamer already exists)
    if (streamer) {
      try {
        ws.send(JSON.stringify({ 
          type: 'connected', 
          executionId,
          message: 'Browser streaming connected' 
        }));
      } catch (error: any) {
        logger.warn('Failed to send connected message', { error: error.message, executionId });
      }
    }
  });

  logger.info('WebSocket server started', { path: '/ws/browser-stream' });
}

/**
 * Register a browser streamer for an execution
 */
export function registerBrowserStream(executionId: string, streamer: BrowserStreamer): void {
  activeStreams.set(executionId, streamer);
  logger.debug('Browser stream registered', { executionId });
  
  // Check if there's a pending WebSocket connection
  const pendingWs = pendingConnections.get(executionId);
  if (pendingWs && pendingWs.readyState === WebSocket.OPEN) {
    streamer.attachWebSocket(pendingWs);
    streamer.startStreaming();
    pendingConnections.delete(executionId);
    logger.debug('Attached pending WebSocket to streamer', { executionId });
  }
}

/**
 * Get active browser streamer
 */
export function getBrowserStream(executionId: string): BrowserStreamer | undefined {
  return activeStreams.get(executionId);
}

/**
 * Unregister a browser streamer
 */
export function unregisterBrowserStream(executionId: string): void {
  const streamer = activeStreams.get(executionId);
  if (streamer) {
    streamer.cleanup();
    activeStreams.delete(executionId);
    logger.debug('Browser stream unregistered', { executionId });
  }
}

