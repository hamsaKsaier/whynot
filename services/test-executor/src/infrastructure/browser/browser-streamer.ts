import { Page } from 'playwright';
import { WebSocket } from 'ws';
import { createLogger } from '../../../shared/logger/logger';
import { TestStep, StepResult } from '../../domain/models';

const logger = createLogger('browser-streamer');

/**
 * Event-driven Browser Streamer
 * Captures frames on events (navigation, step completion) instead of polling.
 * Queues frames until WebSocket connects.
 */
interface FrameData {
  type: string;
  frame?: string;
  url?: string;
  timestamp: number;
  stepIndex?: number;
  format?: 'png' | 'jpeg';
}

export class BrowserStreamer {
  private page: Page | null = null;
  private ws: WebSocket | null = null;
  private isStreaming = false;
  private executionId: string;
  private lastFrameTime = 0;
  // Configurable frame interval (default: 50ms for smoother preview)
  private minFrameInterval = parseInt(process.env.PREVIEW_FRAME_INTERVAL_MS || '50', 10);
  private frameQueue: Array<FrameData> = [];
  private maxQueueSize = 10; // Keep last 10 frames for better buffering
  
  // Frame history for time-travel debugging
  private frameHistory: Map<number, FrameData[]> = new Map(); // stepIndex -> frames[]
  private maxHistoryFrames = parseInt(process.env.PREVIEW_MAX_HISTORY_FRAMES || '100', 10);
  private currentStepIndex: number | null = null;
  
  // Adaptive frame rate tracking
  private pageLoadState: 'loading' | 'idle' | 'active' = 'idle';
  private pendingFrameCapture: NodeJS.Timeout | null = null;
  
  // Screenshot configuration
  private screenshotType: 'png' | 'jpeg' = (process.env.PREVIEW_SCREENSHOT_TYPE || 'jpeg') as 'png' | 'jpeg';
  private jpegQuality = parseInt(process.env.PREVIEW_JPEG_QUALITY || '85', 10);
  private fullPageScreenshot = process.env.PREVIEW_FULL_PAGE === 'true';

  constructor(page: Page, executionId: string) {
    this.page = page;
    this.executionId = executionId;
  }

  /**
   * Attach WebSocket connection
   */
  attachWebSocket(ws: WebSocket): void {
    this.ws = ws;
    logger.info('WebSocket attached to streamer', { executionId: this.executionId });

    // Set up WebSocket error and close handlers
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error in streamer', { error: error.message, executionId: this.executionId, readyState: ws.readyState });
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.warn('WebSocket closed in streamer', { 
        executionId: this.executionId, 
        code, 
        reason: reason.toString(),
        wasCleanup: !this.isStreaming 
      });
      // Don't set ws to null here - cleanup() will handle it
      if (this.isStreaming) {
        this.stopStreaming();
      }
    });

    // Send queued frames first
    if (this.frameQueue.length > 0) {
      logger.debug('Sending queued frames', { count: this.frameQueue.length, executionId: this.executionId });
      this.frameQueue.forEach(frame => this.sendMessageDirect(frame));
      this.frameQueue = [];
    }

    // Send connected message
    this.sendMessageDirect({ type: 'connected', executionId: this.executionId });

    // Send initial URL if page is available
    if (this.page && !this.page.isClosed()) {
      try {
        this.sendMessageDirect({ type: 'url', url: this.page.url() });
      } catch (e) {
        logger.warn('Failed to send initial URL', { error: (e as Error).message, executionId: this.executionId });
      }
    } else {
      logger.warn('Page not available when attaching WebSocket', { 
        executionId: this.executionId, 
        hasPage: !!this.page, 
        isClosed: this.page?.isClosed() 
      });
    }

    // Start streaming if not already started
    if (!this.isStreaming) {
      this.startStreaming();
    }
  }

  /**
   * Start event-driven streaming
   * Sets up event listeners instead of polling
   */
  async startStreaming(): Promise<void> {
    if (this.isStreaming) return;

    if (!this.page || this.page.isClosed()) {
      logger.warn('Cannot start streaming: page is null or closed', { executionId: this.executionId });
      return;
    }

    this.isStreaming = true;
    logger.info('Starting event-driven streaming', { executionId: this.executionId });

    // Capture and queue initial frame (wait for page to be ready)
    try {
      if (this.page && !this.page.isClosed()) {
        const url = this.page.url();
        this.sendMessage({ type: 'url', url });
        // Wait for page to be ready before initial capture
        await this.waitForPageReady();
        await this.captureAndSendFrame();
      }
    } catch (error: any) {
      logger.warn('Failed to capture initial frame', { error: error.message });
    }

    // Setup event listeners for automatic frame capture
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for frame capture
   */
  private setupEventListeners(): void {
    if (!this.page || this.page.isClosed()) return;

    // Capture on navigation - but wait for page to be ready
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page?.mainFrame()) {
        try {
          this.pageLoadState = 'loading';
          // Wait for page to be ready before capturing
          // This prevents screenshot timeouts when page is still loading
          await this.waitForPageReady();
          this.pageLoadState = 'idle';
          await this.captureAndSendFrame();
          this.sendMessage({ type: 'url', url: this.page?.url() || '' });
        } catch (e) {
          this.pageLoadState = 'idle';
          // Ignore errors during navigation events
        }
      }
    });

    // Capture on load - page should be ready by now
    this.page.on('load', async () => {
      try {
        this.pageLoadState = 'active';
        // Wait a bit more for dynamic content
        await this.waitForPageReady();
        this.pageLoadState = 'idle';
        await this.captureAndSendFrame();
      } catch (e) {
        this.pageLoadState = 'idle';
        // Ignore
      }
    });

    // Track page activity for adaptive frame rate
    this.page.on('request', () => {
      this.pageLoadState = 'active';
    });

    this.page.on('response', () => {
      // Reset to idle after a short delay if no more requests
      setTimeout(() => {
        if (this.pageLoadState === 'active') {
          this.pageLoadState = 'idle';
        }
      }, 500);
    });
  }

  /**
   * Wait for page to be in a ready state before taking screenshots
   * This prevents timeouts when page is still loading
   */
  private async waitForPageReady(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;

    try {
      // Try networkidle first (page is stable, no active requests)
      await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
        // If networkidle times out, try domcontentloaded (faster)
        return this.page!.waitForLoadState('domcontentloaded', { timeout: 1000 });
      }).catch(() => {
        // If both fail, just wait a short time for page to stabilize
        return this.page!.waitForTimeout(300);
      });
    } catch (e) {
      // Ignore - proceed anyway
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    if (!this.isStreaming) return;
    this.isStreaming = false;
    logger.debug('Streaming stopped', { executionId: this.executionId });
  }

  /**
   * Get adaptive frame interval based on page state
   */
  private getAdaptiveFrameInterval(): number {
    // Faster capture when page is idle (stable), slower when loading
    switch (this.pageLoadState) {
      case 'loading':
        return this.minFrameInterval * 2; // 100ms when loading
      case 'active':
        return this.minFrameInterval * 1.5; // 75ms when active
      case 'idle':
      default:
        return this.minFrameInterval; // 50ms when idle
    }
  }

  /**
   * Capture a frame and send via WebSocket (or queue if not connected)
   * Rate-limited with adaptive frame rate based on page activity
   */
  private async captureAndSendFrame(stepIndex?: number, forceCapture: boolean = false): Promise<void> {
    // Check rate limit (unless forced)
    const now = Date.now();
    const adaptiveInterval = this.getAdaptiveFrameInterval();
    
    if (!forceCapture && now - this.lastFrameTime < adaptiveInterval) {
      // Schedule delayed capture if not forced
      if (this.pendingFrameCapture) {
        clearTimeout(this.pendingFrameCapture);
      }
      this.pendingFrameCapture = setTimeout(() => {
        this.captureAndSendFrame(stepIndex, false).catch(() => {
          // Ignore errors in delayed capture
        });
      }, adaptiveInterval - (now - this.lastFrameTime));
      return;
    }

    // Clear any pending capture
    if (this.pendingFrameCapture) {
      clearTimeout(this.pendingFrameCapture);
      this.pendingFrameCapture = null;
    }

    if (!this.page || this.page.isClosed()) {
      return;
    }

    try {
      // Wait for page to be ready before taking screenshot (with shorter timeout for speed)
      await this.waitForPageReady();

      // Take screenshot with optimized settings
      const screenshotBuffer = await this.page.screenshot({
        type: this.screenshotType,
        quality: this.screenshotType === 'jpeg' ? this.jpegQuality : undefined,
        fullPage: this.fullPageScreenshot,
        timeout: 5000, // Reduced timeout for faster capture (was 8000)
      });
      
      if (this.page.isClosed()) return;

      const screenshot = screenshotBuffer.toString('base64');
      const url = this.page.url();

      const frameMessage: FrameData = {
        type: 'frame',
        frame: screenshot,
        url,
        timestamp: now,
        stepIndex: stepIndex ?? this.currentStepIndex ?? undefined,
        format: this.screenshotType,
      };

      // Store in history if step index is available
      if (frameMessage.stepIndex !== undefined) {
        this.addToFrameHistory(frameMessage.stepIndex, frameMessage);
      }

      // Send or queue the frame
      this.sendMessage(frameMessage);
      this.lastFrameTime = now;
    } catch (error: any) {
      const isClosedError = error.message?.includes('closed') ||
        error.message?.includes('Target page');
      
      if (isClosedError) {
        this.stopStreaming();
      } else {
        // Log but don't fail - this is for preview, not critical
        logger.debug('Frame capture error (non-critical)', { error: error.message });
      }
    }
  }

  /**
   * Add frame to history for time-travel debugging
   */
  private addToFrameHistory(stepIndex: number, frame: FrameData): void {
    if (!this.frameHistory.has(stepIndex)) {
      this.frameHistory.set(stepIndex, []);
    }
    
    const stepFrames = this.frameHistory.get(stepIndex)!;
    stepFrames.push(frame);
    
    // Limit total frames across all steps
    let totalFrames = 0;
    this.frameHistory.forEach(frames => {
      totalFrames += frames.length;
    });
    
    if (totalFrames > this.maxHistoryFrames) {
      // Remove oldest frames from earliest steps
      const sortedSteps = Array.from(this.frameHistory.keys()).sort((a, b) => a - b);
      for (const stepIdx of sortedSteps) {
        const frames = this.frameHistory.get(stepIdx)!;
        if (frames.length > 0) {
          frames.shift(); // Remove oldest frame
          totalFrames--;
          if (totalFrames <= this.maxHistoryFrames) break;
        }
        if (frames.length === 0) {
          this.frameHistory.delete(stepIdx);
        }
      }
    }
  }

  /**
   * Get frame history for a specific step
   */
  getFrameHistory(stepIndex: number): FrameData[] {
    return this.frameHistory.get(stepIndex) || [];
  }

  /**
   * Get all frame history
   */
  getAllFrameHistory(): Map<number, FrameData[]> {
    return new Map(this.frameHistory);
  }

  /**
   * Send message - queues if WebSocket not ready, sends directly if ready
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessageDirect(message);
    } else {
      // Queue frames for later (limit queue size)
      if (message.type === 'frame') {
        if (this.frameQueue.length >= this.maxQueueSize) {
          this.frameQueue.shift(); // Remove oldest
        }
        this.frameQueue.push(message);
        logger.debug('Frame queued (WebSocket not ready)', { 
          queueSize: this.frameQueue.length,
          executionId: this.executionId 
        });
      }
      // Non-frame messages are dropped if WebSocket not ready
    }
  }

  /**
   * Send message directly to WebSocket (assumes connection is ready)
   */
  private sendMessageDirect(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        if (message.type === 'frame') {
          logger.debug('Frame sent via WebSocket', { executionId: this.executionId });
        }
      } catch (error: any) {
        logger.debug('WebSocket send error', { error: error.message });
      }
    }
  }

  /**
   * Send URL update (public method for external use)
   */
  sendUrlUpdate(url: string): void {
    this.sendMessage({ type: 'url', url });
  }

  /**
   * Called when navigation occurs
   */
  async onNavigation(url: string): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      this.sendMessage({ type: 'url', url });
      // Capture frame for live preview (non-blocking, failures are ignored)
      this.captureAndSendFrame().catch(() => {
        // Ignore screenshot failures during navigation - step screenshots will handle it
      });
    }
  }

  /**
   * Send log message to frontend
   */
  sendLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    this.sendMessageDirect({
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
  sendStepStart(step: TestStep, index: number): void {
    this.currentStepIndex = index;
    this.sendMessageDirect({
      type: 'step_start',
      step,
      stepIndex: index,
      timestamp: Date.now()
    });
  }

  /**
   * Capture frame after step completion
   * This is the main way frames are captured (event-driven)
   */
  async captureFrameOnStepComplete(stepIndex?: number): Promise<void> {
    if (!this.page || this.page.isClosed()) {
      return;
    }
    // Update current step index
    if (stepIndex !== undefined) {
      this.currentStepIndex = stepIndex;
    }
    // Force capture (bypass rate limit for step completions)
    // Non-blocking - failures are ignored since step already has screenshot
    this.lastFrameTime = 0;
    this.captureAndSendFrame(stepIndex, true).catch(() => {
      // Ignore - step executor already captured screenshot
    });
  }

  /**
   * Send step complete event
   */
  sendStepComplete(stepResult: StepResult, index: number): void {
    this.sendMessageDirect({
      type: 'step_complete',
      stepResult,
      stepIndex: index,
      timestamp: Date.now()
    });
  }

  /**
   * Send final execution result
   */
  sendFinalResult(result: any): void {
    this.sendMessageDirect({
      type: 'execution_complete',
      result
    });
  }

  /**
   * Send selector attempt event
   */
  sendSelectorAttempt(
    stepIndex: number,
    selector: any,
    attemptNumber: number,
    totalAttempts: number,
    status: 'trying' | 'failed' | 'succeeded'
  ): void {
    this.sendMessageDirect({
      type: 'selector_attempt',
      stepIndex,
      selector,
      attemptNumber,
      totalAttempts,
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Send selector recovery start event
   */
  sendSelectorRecoveryStart(
    stepIndex: number,
    reason: string,
    attemptedSelectors: any[]
  ): void {
    this.sendMessageDirect({
      type: 'selector_recovery_start',
      stepIndex,
      reason,
      attemptedSelectors,
      timestamp: Date.now()
    });
  }

  /**
   * Send selector recovery success event
   */
  sendSelectorRecoverySuccess(
    stepIndex: number,
    successfulSelector: any,
    strategyUsed: string
  ): void {
    this.sendMessageDirect({
      type: 'selector_recovery_success',
      stepIndex,
      successfulSelector,
      strategyUsed,
      timestamp: Date.now()
    });
  }

  /**
   * Send agent activity message for real-time feedback
   */
  sendAgentMessage(
    stepIndex: number,
    type: 'analyzing' | 'recovery_attempt' | 'recovery_success' | 'recovery_failed' | 'needs_help',
    message: string,
    data?: any
  ): void {
    this.sendMessageDirect({
      type: 'agent_message',
      stepIndex,
      agentType: type,
      message,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopStreaming();
    
    // Clear pending frame capture
    if (this.pendingFrameCapture) {
      clearTimeout(this.pendingFrameCapture);
      this.pendingFrameCapture = null;
    }
    
    // Close WebSocket gracefully if it's still open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close(1000, 'Test execution completed'); // Normal closure
        logger.debug('WebSocket closed gracefully during cleanup', { executionId: this.executionId });
      } catch (error: any) {
        logger.warn('Error closing WebSocket during cleanup', { error: error.message, executionId: this.executionId });
      }
    }
    this.frameQueue = [];
    this.frameHistory.clear();
    this.page = null;
    this.ws = null;
  }
}
