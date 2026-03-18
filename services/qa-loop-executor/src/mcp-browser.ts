import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
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

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start the Playwright MCP server as a subprocess and connect.
   */
  async start(): Promise<void> {
    logger.info('Starting Playwright MCP server', { sessionId: this.sessionId });

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@0.0.68', '--headless', '--browser', 'firefox']
    });

    this.client = new Client(
      { name: 'whynot-qa-loop', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;

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
      // Check for image content in ANY tool response (some tools return screenshots)
      const imageContent = content?.find(c => c.type === 'image');
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
      const img = content?.find(c => c.type === 'image');
      if (img && img.data) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: { url: 'current_page', screenshot: img.data }
        });
      }
    } catch {
      // Silently ignore — preview screenshot is not critical
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
      const img = content?.find(c => c.type === 'image');
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
   */
  async stop(): Promise<void> {
    logger.info('Stopping Playwright MCP server', { sessionId: this.sessionId });

    try {
      if (this.client && this.isConnected) {
        await this.client.close();
      }
    } catch (error: any) {
      logger.warn('Error closing MCP client', { error: error.message });
    }

    // Stop recording if still active
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isRecording = false;

    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.tools = [];
    this.loadTimesCache.clear();

    logger.info('Playwright MCP server stopped', { sessionId: this.sessionId });
  }
}
