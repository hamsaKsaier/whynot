import { Page } from 'playwright';
import { WebSocket } from 'ws';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('browser-streamer');

export class BrowserStreamer {
  private page: Page | null = null;
  private ws: WebSocket | null = null;
  private streamingInterval: NodeJS.Timeout | null = null;
  private isStreaming = false;
  private frameInterval = 100; // Capture frame every 100ms
  private executionId: string;
  private frameQueue: any[] = []; // Queue frames when WebSocket not ready

  constructor(page: Page, executionId: string) {
    this.page = page;
    this.executionId = executionId;
  }

  /**
   * Attach WebSocket connection
   */
  attachWebSocket(ws: WebSocket): void {
    this.ws = ws;
    logger.debug('WebSocket attached to browser streamer', { executionId: this.executionId });

    // Send queued frames if any
    if (this.frameQueue.length > 0) {
      logger.debug('Sending queued frames', { count: this.frameQueue.length, executionId: this.executionId });
      this.frameQueue.forEach(frame => this.sendMessage(frame));
      this.frameQueue = [];
    }

    // Send connected message
    this.sendMessage({ type: 'connected', executionId: this.executionId });

    // Ensure streaming is started
    if (!this.isStreaming) {
      this.startStreaming();
    }
  }

  /**
   * Start streaming browser frames
   * Can start even without WebSocket - frames will be queued
   */
  async startStreaming(): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    logger.info('Starting browser frame streaming', { executionId: this.executionId, hasWebSocket: !!this.ws });

    // Send initial URL
    const url = this.page?.url() || '';
    this.sendMessage({ type: 'url', url });

    // Send initial frame immediately
    try {
      await this.captureAndSendFrame();
      logger.debug('Initial frame sent', { executionId: this.executionId });
    } catch (error: any) {
      logger.warn('Failed to send initial frame', { error: error.message, executionId: this.executionId });
    }

    // Start capturing frames periodically
    this.streamingInterval = setInterval(async () => {
      try {
        await this.captureAndSendFrame();
      } catch (error: any) {
        logger.error('Error capturing frame', { error: error.message, executionId: this.executionId });
        this.sendMessage({
          type: 'error',
          message: error.message || 'Failed to capture frame'
        });
      }
    }, this.frameInterval);
  }

  /**
   * Stop streaming browser frames
   */
  stopStreaming(): void {
    if (!this.isStreaming) {
      return;
    }

    this.isStreaming = false;
    logger.debug('Stopping browser frame streaming');

    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }
  }

  /**
   * Capture a frame and send via WebSocket
   * Queues frame if WebSocket not ready
   */
  private async captureAndSendFrame(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      // Capture screenshot as base64
      const screenshotBuffer = await this.page.screenshot({
        type: 'png',
        fullPage: false,
      });
      const screenshot = screenshotBuffer.toString('base64');

      const url = this.page.url();
      const frame = {
        type: 'frame',
        frame: screenshot,
        url,
        timestamp: Date.now(),
      };

      // Send frame if WebSocket is ready, otherwise queue it
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(frame);
        // Log frame sent periodically (every 10 frames to avoid spam)
        if (frame.timestamp % 1000 < 100) {
          logger.debug('Frame sent', {
            executionId: this.executionId,
            url: frame.url,
            timestamp: frame.timestamp
          });
        }
      } else {
        // Queue frame for when WebSocket connects
        // Keep queue size reasonable (last 10 frames)
        if (this.frameQueue.length >= 10) {
          this.frameQueue.shift(); // Remove oldest frame
        }
        this.frameQueue.push(frame);
        // Log queuing only occasionally to avoid spam
        if (this.frameQueue.length === 1 || this.frameQueue.length % 5 === 0) {
          logger.debug('Frame queued (WebSocket not ready)', {
            executionId: this.executionId,
            queueSize: this.frameQueue.length,
            wsReady: this.ws ? this.ws.readyState === WebSocket.OPEN : false,
            wsState: this.ws ? this.ws.readyState : 'no websocket'
          });
        }
      }
    } catch (error: any) {
      logger.error('Error capturing screenshot', { error: error.message, executionId: this.executionId });
      // Don't throw - allow streaming to continue
    }
  }

  /**
   * Send message via WebSocket
   * Queues message if WebSocket not ready (except for frames which are handled separately)
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        if (message.type === 'frame') {
          logger.debug('Frame sent via WebSocket', { executionId: this.executionId, timestamp: message.timestamp });
        }
      } catch (error: any) {
        logger.error('Error sending WebSocket message', { error: error.message, executionId: this.executionId });
      }
    } else if (message.type !== 'frame') {
      // For non-frame messages, log that WebSocket is not ready
      logger.debug('WebSocket not ready, message not sent', {
        type: message.type,
        executionId: this.executionId,
        wsReady: this.ws ? this.ws.readyState === WebSocket.OPEN : false
      });
    }
    // Frames are handled separately in captureAndSendFrame with queueing
  }

  /**
   * Update URL when navigation occurs
   */
  async onNavigation(url: string): Promise<void> {
    this.sendMessage({ type: 'url', url });
  }

  /**
   * Send log message to frontend
   */
  sendLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    this.sendMessage({
      type: 'log',
      level,
      message,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Send final execution result when test completes
   */
  sendFinalResult(result: any): void {
    this.sendMessage({
      type: 'execution_complete',
      result
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopStreaming();
    this.page = null;
    this.ws = null;
  }
}

