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
  private screenshotTimeout: number; // Timeout for screenshot operations

  constructor(page: Page, executionId: string) {
    this.page = page;
    this.executionId = executionId;
    // Disable font loading wait for screenshots to prevent timeouts
    // This significantly improves screenshot performance
    if (!process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY) {
      process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
    }
    // Configurable screenshot timeout (default: 60s, max: 120s)
    this.screenshotTimeout = Math.min(
      Math.max(parseInt(process.env.SCREENSHOT_TIMEOUT_MS || '60000', 10), 10000),
      120000
    );
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:103', message: 'captureAndSendFrame entry', data: { executionId: this.executionId, hasPage: !!this.page, pageIsClosed: this.page?.isClosed() || false }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
    // #endregion

    if (!this.page) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:107', message: 'Page is null, stopping stream', data: { executionId: this.executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
      // #endregion
      // Page is null, stop streaming
      this.stopStreaming();
      return;
    }

    try {
      // Check if page is closed before attempting screenshot
      if (this.page.isClosed()) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:115', message: 'Page is closed, stopping stream', data: { executionId: this.executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion
        logger.debug('Page is closed, stopping stream', { executionId: this.executionId });
        this.stopStreaming();
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:122', message: 'Before screenshot capture', data: { executionId: this.executionId, timeout: this.screenshotTimeout, pageIsClosed: this.page.isClosed() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
      // #endregion

      // Capture screenshot as base64 with explicit timeout
      // Pass timeout directly to Playwright's screenshot method
      const screenshotBuffer = await this.page.screenshot({
        type: 'png',
        fullPage: false,
        timeout: this.screenshotTimeout,
      });
      const screenshot = screenshotBuffer.toString('base64');

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:131', message: 'Screenshot captured successfully', data: { executionId: this.executionId, screenshotSize: screenshot.length, hasPage: !!this.page, pageIsClosed: this.page?.isClosed() || false }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
      // #endregion

      // Re-check page is still valid before accessing url()
      if (!this.page || this.page.isClosed()) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:136', message: 'Page became null/closed after screenshot', data: { executionId: this.executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
        // #endregion
        logger.warn('Page became null or closed after screenshot capture', { executionId: this.executionId });
        this.stopStreaming();
        return;
      }

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:161', message: 'Screenshot capture error', data: { executionId: this.executionId, errorMessage: error.message, errorName: error.name, isTimeout: error.message?.includes('timeout') || error.message?.includes('Timeout'), isClosed: error.message?.includes('closed') || error.message?.includes('Target page') }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
      // #endregion

      // Check if error is due to page being closed
      if (error.message?.includes('closed') || error.message?.includes('Target page')) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:166', message: 'Page closed during frame capture', data: { executionId: this.executionId, errorMessage: error.message }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion
        logger.debug('Page closed during frame capture, stopping stream', {
          error: error.message,
          executionId: this.executionId
        });
        this.stopStreaming();
        return;
      }

      // Check if error is timeout-related
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'browser-streamer.ts:177', message: 'Screenshot timeout error', data: { executionId: this.executionId, timeout: this.screenshotTimeout, errorMessage: error.message }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion
        logger.error('Screenshot timeout exceeded', {
          error: error.message,
          executionId: this.executionId,
          timeout: this.screenshotTimeout
        });
        // Don't stop streaming on timeout - might be transient, continue trying
        return;
      }

      // For other errors, log but don't stop streaming (might be transient)
      logger.error('Error capturing screenshot', { error: error.message, executionId: this.executionId });
      // Don't throw - allow streaming to continue for transient errors
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
   * Send step start event
   */
  sendStepStart(step: { id: string; action: string; description: string }, stepIndex: number): void {
    this.sendMessage({
      type: 'step_start',
      stepIndex,
      step: {
        id: step.id,
        action: step.action,
        description: step.description
      },
      timestamp: Date.now()
    });
  }

  /**
   * Send step complete event
   */
  sendStepComplete(stepResult: { step_id: string; success: boolean; error?: string; execution_time_ms: number; element_found?: boolean; selector_used?: any }, stepIndex: number): void {
    this.sendMessage({
      type: 'step_complete',
      stepIndex,
      stepResult: {
        step_id: stepResult.step_id,
        success: stepResult.success,
        error: stepResult.error,
        execution_time_ms: stepResult.execution_time_ms,
        element_found: stepResult.element_found,
        selector_used: stepResult.selector_used
      },
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

