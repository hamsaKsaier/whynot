import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../../shared/logger/logger';
import { emitToSession } from './api/websocket';

const logger = createLogger('mcp-browser');

/**
 * MCP tools that Claude should never call directly.
 * - browser_install: browser is pre-installed; calling it wastes tool-call budget
 * - browser_close: we manage the browser lifecycle
 * - browser_run_code: arbitrary JS execution is already handled via browser_evaluate
 * - browser_resize: not useful for testing, wastes tool calls
 */
const EXCLUDED_MCP_TOOLS = new Set([
  'browser_install',
  'browser_close',
  'browser_run_code',
  'browser_resize',
]);

/**
 * Manages a Playwright MCP server subprocess for browser automation.
 * Spawns @playwright/mcp as a child process, connects via stdio transport,
 * and provides methods to list tools, call tools, and handle cleanup.
 */
export class MCPBrowser {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private mcpProcess: ChildProcess | null = null;
  private tools: Anthropic.Tool[] = [];
  private sessionId: string;
  private isConnected = false;

  // Track navigation timing for load time reporting
  private lastNavigationTime = 0;
  private loadTimesCache = new Map<string, number>();

  // Video recording: capture screenshots as frames to disk
  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private frameDir: string | null = null;
  private frameCount = 0;
  private isRecording = false;

  // Track when the browser was started for max-duration safety net
  private startedAt: number = 0;

  // True while a tool call is in flight — guards against concurrent cleanup
  // killing a browser mid-operation from another session's forceCleanup() sweep.
  private isExecuting = false;

  /** Maximum browser session duration in ms (45 minutes). */
  private static readonly MAX_BROWSER_DURATION_MS = 45 * 60 * 1000;

  /**
   * Global registry of active MCPBrowser instances, keyed by sessionId.
   * Used by forceCleanup() to kill any lingering browser from a previous session
   * before launching a new one — eliminates "browser is not free" race conditions.
   */
  private static activeBrowsers = new Map<string, MCPBrowser>();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Force-cleanup browser(s) to prevent "browser is not free" race conditions.
   *
   * @param sessionId — if provided, only kill that session's browser.
   *                     If omitted, only kill browsers that have EXPIRED (>30 min old).
   *                     NEVER kills another active session's browser.
   */
  static async forceCleanup(sessionId?: string): Promise<void> {
    if (sessionId) {
      const existing = MCPBrowser.activeBrowsers.get(sessionId);
      if (existing) {
        logger.warn('Force-cleaning up existing browser before new session', { sessionId });
        try {
          await existing.forceStop();
        } catch (err: any) {
          logger.warn('forceCleanup: forceStop threw, ignoring', { sessionId, error: err.message });
        }
        MCPBrowser.activeBrowsers.delete(sessionId);
        // Wait for OS-level process cleanup
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } else {
      // Only kill EXPIRED browsers — never kill another active session's browser
      // Also skip browsers that are currently executing a tool call (isExecuting=true)
      const entries = Array.from(MCPBrowser.activeBrowsers.entries());
      let cleaned = 0;
      for (const [sid, browser] of entries) {
        if (browser.isExecuting) {
          logger.info('Skipping cleanup for actively-executing browser', { sessionId: sid });
          continue;
        }
        if (browser.isExpired()) {
          logger.warn('Force-cleaning up expired browser', { sessionId: sid });
          try {
            await browser.forceStop();
          } catch {
            // ignore
          }
          MCPBrowser.activeBrowsers.delete(sid);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  /**
   * Check if this browser has exceeded the maximum allowed duration.
   */
  isExpired(): boolean {
    if (this.startedAt === 0) return false;
    return Date.now() - this.startedAt > MCPBrowser.MAX_BROWSER_DURATION_MS;
  }

  /**
   * Kill the MCP child process immediately using SIGKILL.
   * This is the most reliable way to release the browser lock file.
   */
  private killMcpProcess(): void {
    if (this.mcpProcess) {
      try {
        const pid = this.mcpProcess.pid;
        this.mcpProcess.kill('SIGKILL');
        logger.info('Killed MCP child process', { sessionId: this.sessionId, pid });
      } catch (err: any) {
        logger.warn('Failed to kill MCP child process', {
          sessionId: this.sessionId,
          error: err.message
        });
      }
      this.mcpProcess = null;
    }
    // Also try closing the transport as a belt-and-suspenders measure
    try {
      if (this.transport) {
        (this.transport as any)?.close?.();
      }
    } catch {
      // Ignore — transport may already be dead
    }
  }

  /**
   * Force-stop the browser, killing the subprocess if normal close fails.
   * Used as a safety net when the browser is stuck or leaked.
   */
  async forceStop(): Promise<void> {
    logger.warn('Force-stopping MCP browser', { sessionId: this.sessionId });

    // Stop recording immediately
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isRecording = false;

    // Try graceful close with a timeout
    try {
      if (this.client && this.isConnected) {
        const closePromise = this.client.close();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Close timed out')), 5000)
        );
        await Promise.race([closePromise, timeoutPromise]);
      }
    } catch (error: any) {
      logger.warn('Graceful close failed during force-stop, killing process', {
        sessionId: this.sessionId,
        error: error.message
      });
    }

    // Always kill the MCP subprocess to release the browser lock
    this.killMcpProcess();

    // Reset all state and unregister from the global registry
    this.client = null;
    this.transport = null;
    this.mcpProcess = null;
    this.isConnected = false;
    this.tools = [];
    this.loadTimesCache.clear();
    this.startedAt = 0;
    MCPBrowser.activeBrowsers.delete(this.sessionId);

    logger.info('MCP browser force-stopped', { sessionId: this.sessionId });
  }

  /**
   * Start the Playwright MCP server as a subprocess and connect.
   * Automatically force-kills any previous browser for this session first.
   */
  async start(): Promise<void> {
    // Kill any lingering browser for THIS session to prevent "browser is already in use"
    // Only cleans up this session's browser — never kills another user's active browser
    await MCPBrowser.forceCleanup(this.sessionId);
    // Also clean up any expired browsers (>30 min old) as a safety net
    await MCPBrowser.forceCleanup();

    logger.info('Starting Playwright MCP server', { sessionId: this.sessionId });

    // Register this instance in the global registry
    MCPBrowser.activeBrowsers.set(this.sessionId, this);

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@0.0.68', '--headless', '--browser', 'chromium', '--isolated']
    });

    this.client = new Client(
      { name: 'whynot-qa-loop', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
    this.startedAt = Date.now();

    // Capture the child process reference for reliable cleanup (SIGKILL on stop/forceStop).
    // StdioClientTransport stores the spawned process internally — extract it for direct kill access.
    const transportAny = this.transport as any;
    this.mcpProcess = (transportAny._process || transportAny.process || transportAny._subprocess || null) as ChildProcess | null;
    if (this.mcpProcess) {
      logger.info('Captured MCP child process', { sessionId: this.sessionId, pid: this.mcpProcess.pid });
    } else {
      logger.warn('Could not capture MCP child process reference — fallback to transport.close()', { sessionId: this.sessionId });
    }

    // Pre-install browser so Claude never needs to call browser_install
    try {
      await this.client.callTool({ name: 'browser_install', arguments: {} });
      logger.info('Browser pre-installed', { sessionId: this.sessionId });
    } catch (err: any) {
      logger.warn('Browser pre-install skipped (may already be installed)', {
        sessionId: this.sessionId, error: err.message
      });
    }

    // Cache tool definitions (filter out tools Claude should never call)
    const { tools } = await this.client.listTools();
    this.tools = tools
      .filter(t => !EXCLUDED_MCP_TOOLS.has(t.name))
      .map(t => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.inputSchema as Anthropic.Tool['input_schema']
      }));

    logger.info('Playwright MCP server started', {
      sessionId: this.sessionId,
      toolCount: this.tools.length,
      tools: this.tools.map(t => t.name)
    });
  }

  /**
   * Get MCP tool definitions in Anthropic API format.
   */
  getTools(): Anthropic.Tool[] {
    return this.tools;
  }

  /**
   * Get cached load time for a URL (tracked during browser_navigate calls).
   */
  getLoadTime(url: string): number | undefined {
    return this.loadTimesCache.get(url);
  }

  /**
   * Check if a tool name is an MCP browser tool.
   */
  isMCPTool(toolName: string): boolean {
    return toolName.startsWith('browser_');
  }

  /**
   * Call an MCP tool and return the result.
   * Handles special cases: screenshots emitted to WebSocket, navigation timing.
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<{ data?: any; error?: string }> {
    if (!this.client || !this.isConnected) {
      return { error: 'MCP browser not connected' };
    }

    this.isExecuting = true;
    try {
      // Track navigation timing
      if (toolName === 'browser_navigate') {
        this.lastNavigationTime = Date.now();
        logger.info('Navigating to URL', { sessionId: this.sessionId, url: args.url });
      } else {
        logger.info('MCP tool call', { sessionId: this.sessionId, tool: toolName, args: Object.keys(args) });
      }

      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      // Process the result content
      const content = result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>;

      // Handle navigation load time tracking
      if (toolName === 'browser_navigate' && args.url) {
        const loadTimeMs = Date.now() - this.lastNavigationTime;
        this.loadTimesCache.set(args.url, loadTimeMs);
      }

      // Handle screenshots — emit to WebSocket for frontend preview
      // Check for image content in ANY tool response (some tools return screenshots).
      // Some MCP versions return type:'image', others return type:'resource' with an image mimeType.
      const imageContent = content?.find(c =>
        c.type === 'image' ||
        (c.type === 'resource' && c.mimeType?.startsWith('image/'))
      );
      if (toolName === 'browser_take_screenshot' || imageContent) {
        logger.debug('Screenshot content analysis', {
          sessionId: this.sessionId,
          tool: toolName,
          contentTypes: content?.map(c => ({ type: c.type, mimeType: c.mimeType, hasData: !!c.data })) || [],
          hasImage: !!imageContent,
          imageDataLength: imageContent?.data?.length || 0
        });
      }
      if (imageContent && imageContent.data) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: {
            url: args.url || 'current_page',
            screenshot: imageContent.data
          }
        });

        // Also save as a video frame if recording is active
        if (this.isRecording && this.frameDir) {
          this.frameCount++;
          const framePath = path.join(this.frameDir, `frame_${String(this.frameCount).padStart(4, '0')}.png`);
          fs.promises.writeFile(framePath, Buffer.from(imageContent.data, 'base64')).catch(() => {});
        }
      }

      // Auto-take screenshot for the frontend preview after key actions
      const previewTriggers = ['browser_navigate', 'browser_snapshot', 'browser_click'];
      if (previewTriggers.includes(toolName) && !imageContent) {
        this.takeScreenshotForPreview().catch(() => {});
      }

      // Extract text content for Claude
      const textParts = content
        ?.filter(c => c.type === 'text')
        ?.map(c => c.text)
        ?.join('\n') || '';

      // For screenshots, don't send the base64 image to Claude (token waste)
      // Just tell Claude the screenshot was captured
      if (toolName === 'browser_take_screenshot') {
        return {
          data: {
            success: true,
            message: 'Screenshot captured and sent to client'
          }
        };
      }

      // For all other tools, return the text content
      return { data: textParts || { success: true } };

    } catch (error: any) {
      logger.error('MCP tool call failed', {
        sessionId: this.sessionId,
        tool: toolName,
        error: error.message
      });
      return { error: `MCP tool ${toolName} failed: ${error.message}` };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Take a screenshot silently for the frontend preview (non-blocking).
   */
  private async takeScreenshotForPreview(): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const result = await this.client.callTool({
        name: 'browser_take_screenshot',
        arguments: {}
      });
      const content = result.content as Array<{ type: string; data?: string; mimeType?: string }>;
      // Match both type:'image' and type:'resource' with image mimeType
      const img = content?.find(c =>
        c.type === 'image' ||
        (c.type === 'resource' && c.mimeType?.startsWith('image/'))
      );
      if (img && img.data) {
        logger.info('Screenshot captured for preview', {
          sessionId: this.sessionId,
          dataLength: img.data.length,
          contentType: img.type,
          mimeType: img.mimeType
        });
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: { url: 'current_page', screenshot: img.data }
        });
      } else {
        logger.warn('Screenshot returned no image data', {
          sessionId: this.sessionId,
          contentTypes: content?.map(c => ({ type: c.type, mimeType: c.mimeType })) || [],
          contentLength: content?.length || 0,
          resultPreview: JSON.stringify(result).substring(0, 300)
        });
      }
    } catch (err: any) {
      logger.error('Preview screenshot failed', {
        sessionId: this.sessionId,
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 3).join(' | ')
      });
    }
  }

  // ─── Video Recording ───

  /**
   * Start recording screenshots as video frames to disk.
   * Captures a frame every FRAME_INTERVAL_MS milliseconds.
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    const intervalMs = parseInt(process.env.VIDEO_FRAME_INTERVAL_MS || '2000', 10);
    this.frameDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `qa-frames-${this.sessionId}-`));
    this.frameCount = 0;
    this.isRecording = true;

    logger.info('Video recording started', { sessionId: this.sessionId, frameDir: this.frameDir, intervalMs });

    this.captureInterval = setInterval(async () => {
      if (!this.isRecording || !this.client || !this.isConnected) return;
      try {
        await this.captureFrame();
      } catch {
        // Non-critical — skip this frame
      }
    }, intervalMs);
  }

  /**
   * Capture a single screenshot frame and write it to disk.
   */
  private async captureFrame(): Promise<void> {
    if (!this.client || !this.isConnected || !this.frameDir) return;

    try {
      const result = await this.client.callTool({
        name: 'browser_take_screenshot',
        arguments: {}
      });
      const content = result.content as Array<{ type: string; data?: string; mimeType?: string }>;
      const img = content?.find(c =>
        c.type === 'image' ||
        (c.type === 'resource' && c.mimeType?.startsWith('image/'))
      );
      if (img?.data) {
        this.frameCount++;
        const framePath = path.join(this.frameDir, `frame_${String(this.frameCount).padStart(4, '0')}.png`);
        await fs.promises.writeFile(framePath, Buffer.from(img.data, 'base64'));
      }
    } catch {
      // Silently skip — frame capture is best-effort
    }
  }

  /**
   * Stop recording and return frame info for stitching.
   */
  stopRecording(): { frameDir: string | null; frameCount: number } {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isRecording = false;

    logger.info('Video recording stopped', {
      sessionId: this.sessionId,
      frameCount: this.frameCount,
      frameDir: this.frameDir
    });

    return { frameDir: this.frameDir, frameCount: this.frameCount };
  }

  /**
   * Stop the MCP server and clean up resources.
   * Uses a timeout to prevent hanging on unresponsive processes.
   * Cleanup always runs in a finally block to prevent leaked browsers.
   */
  async stop(): Promise<void> {
    logger.info('Stopping Playwright MCP server', { sessionId: this.sessionId });

    try {
      // Stop recording first to prevent new frame captures during shutdown
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = null;
      }
      this.isRecording = false;

      try {
        if (this.client && this.isConnected) {
          // Timeout the close operation to prevent hanging
          const closePromise = this.client.close();
          const timeoutPromise = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Close timed out after 10s')), 10000)
          );
          await Promise.race([closePromise, timeoutPromise]);
        }
      } catch (error: any) {
        logger.warn('Error closing MCP client, forcing cleanup', {
          sessionId: this.sessionId,
          error: error.message
        });
      }

      // Always kill the MCP subprocess to release the browser lock
      this.killMcpProcess();
    } finally {
      // Always reset state and unregister from the global registry
      this.client = null;
      this.transport = null;
      this.mcpProcess = null;
      this.isConnected = false;
      this.tools = [];
      this.loadTimesCache.clear();
      this.startedAt = 0;
      MCPBrowser.activeBrowsers.delete(this.sessionId);

      logger.info('Playwright MCP server stopped', { sessionId: this.sessionId });
    }
  }
}
