import axios from 'axios';
import { createLogger } from '../../../shared/logger/logger';
import { LoopConfig } from '../loop-orchestrator';
import { ToolResult } from '../tool-executor';
import { emitToSession } from '../api/websocket';

const logger = createLogger('browser-tools');

interface PageCaptureResult {
  url: string;
  title: string;
  html: string;
  screenshot: string;
  loadTimeMs?: number; // real Navigation Timing measurement from test-executor
}

export class BrowserTools {
  private sessionId: string;
  private config: LoopConfig;
  private testExecutorUrl: string;
  private currentUrl: string = '';
  private browserContextId: string | null = null;
  /** url → loadTimeMs — populated by navigate(), consumed by ToolExecutor for markPageExplored */
  private loadTimesCache: Map<string, number> = new Map();

  constructor(sessionId: string, config: LoopConfig) {
    this.sessionId = sessionId;
    this.config = config;
    this.testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';
  }

  /** Return the load time recorded the last time this URL was navigated to. */
  getLoadTime(url: string): number | undefined {
    return this.loadTimesCache.get(url);
  }

  private async ensureBrowserContext(): Promise<string> {
    if (!this.browserContextId) {
      // Create a new browser context for this session
      try {
        const response = await axios.post(`${this.testExecutorUrl}/api/context/create`, {
          sessionId: this.sessionId
        });
        this.browserContextId = response.data.contextId || this.sessionId;
      } catch (error) {
        // Fallback - use session ID as context ID
        this.browserContextId = this.sessionId;
      }
    }
    return this.browserContextId;
  }

  async navigate(url: string): Promise<ToolResult> {
    try {
      logger.info('Navigating to URL', { sessionId: this.sessionId, url });

      // Make URL absolute if relative
      let absoluteUrl = url;
      if (url.startsWith('/')) {
        const baseUrl = new URL(this.config.targetUrl);
        absoluteUrl = `${baseUrl.origin}${url}`;
      } else if (!url.startsWith('http')) {
        absoluteUrl = `${this.config.targetUrl}${url.startsWith('/') ? '' : '/'}${url}`;
      }

      // Call test executor to navigate and capture page
      const response = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        url: absoluteUrl,
        contextId: await this.ensureBrowserContext(),
        includeScreenshot: true,
        timeout: 30000
      }, {
        timeout: 60000
      });

      const result: PageCaptureResult = response.data;
      this.currentUrl = result.url;

      // Cache load time so ToolExecutor can persist it when mark_page_explored is called
      if (result.loadTimeMs !== undefined) {
        this.loadTimesCache.set(result.url, result.loadTimeMs);
      }

      // Emit screenshot to websocket for live preview
      if (result.screenshot) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: {
            url: result.url,
            screenshot: result.screenshot
          }
        });
      }

      // Truncate HTML for context window
      // COST OPTIMIZATION: Reduced from 15K to 5K chars
      const truncatedHtml = result.html.length > 5000
        ? result.html.substring(0, 5000) + '\n... (truncated)'
        : result.html;

      return {
        data: {
          success: true,
          url: result.url,
          title: result.title,
          html_preview: truncatedHtml,
          screenshot: result.screenshot ? '[screenshot captured]' : null,
          // Pass real load time so it can be stored in discovered_elements
          ...(result.loadTimeMs !== undefined ? { loadTimeMs: result.loadTimeMs } : {})
        }
      };
    } catch (error: any) {
      logger.error('Navigation failed', {
        sessionId: this.sessionId,
        url,
        error: error.message
      });
      return {
        error: `Failed to navigate to ${url}: ${error.message}`
      };
    }
  }

  async click(selector: string): Promise<ToolResult> {
    try {
      logger.info('Clicking element', { sessionId: this.sessionId, selector });

      const response = await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'click',
        selector,
        contextId: await this.ensureBrowserContext(),
        timeout: 10000
      }, {
        timeout: 30000
      });

      // Get updated page state after click
      const pageState = await this.captureCurrentState();

      // Emit screenshot
      if (pageState.screenshot) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: {
            url: pageState.url,
            screenshot: pageState.screenshot
          }
        });
      }

      this.currentUrl = pageState.url;

      return {
        data: {
          success: true,
          newUrl: pageState.url,
          urlChanged: pageState.url !== this.currentUrl,
          // COST OPTIMIZATION: Reduced from 10K to 3K
          html_preview: pageState.html?.substring(0, 3000)
        }
      };
    } catch (error: any) {
      logger.error('Click failed', {
        sessionId: this.sessionId,
        selector,
        error: error.message
      });
      return {
        error: `Failed to click "${selector}": ${error.message}`
      };
    }
  }

  async typeText(selector: string, text: string, clearFirst: boolean = true): Promise<ToolResult> {
    try {
      logger.info('Typing text', { sessionId: this.sessionId, selector, textLength: text.length });

      const response = await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'type',
        selector,
        value: text,
        clearFirst,
        contextId: await this.ensureBrowserContext(),
        timeout: 10000
      }, {
        timeout: 30000
      });

      return {
        data: {
          success: true,
          typed: text.length <= 50 ? text : `${text.substring(0, 50)}...`
        }
      };
    } catch (error: any) {
      logger.error('Type failed', {
        sessionId: this.sessionId,
        selector,
        error: error.message
      });
      return {
        error: `Failed to type into "${selector}": ${error.message}`
      };
    }
  }

  async screenshot(): Promise<ToolResult> {
    try {
      const response = await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'screenshot',
        contextId: await this.ensureBrowserContext()
      }, {
        timeout: 30000
      });

      const screenshot = response.data.screenshot;

      // Emit to websocket
      emitToSession(this.sessionId, {
        type: 'screenshot',
        data: {
          url: this.currentUrl,
          screenshot
        }
      });

      return {
        data: {
          success: true,
          url: this.currentUrl,
          screenshot: '[screenshot captured and sent to client]'
        }
      };
    } catch (error: any) {
      logger.error('Screenshot failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to take screenshot: ${error.message}` };
    }
  }

  async getPageElements(): Promise<ToolResult> {
    try {
      logger.info('Getting page elements', { sessionId: this.sessionId });

      const response = await axios.post(`${this.testExecutorUrl}/api/detect-elements`, {
        contextId: await this.ensureBrowserContext()
      }, {
        timeout: 30000
      });

      const elements = response.data;

      // Summarize elements for Claude
      const summary = {
        links: elements.links?.slice(0, 20).map((l: any) => ({
          text: l.text?.substring(0, 50),
          href: l.href
        })) || [],
        buttons: elements.buttons?.slice(0, 15).map((b: any) => ({
          text: b.text?.substring(0, 50),
          selector: b.selector
        })) || [],
        forms: elements.forms?.slice(0, 5).map((f: any) => ({
          action: f.action,
          method: f.method,
          fields: Array.isArray(f.fields) ? f.fields.slice(0, 10) : []
        })) || [],
        inputs: elements.inputs?.slice(0, 15).map((i: any) => ({
          type: i.type,
          name: i.name,
          placeholder: i.placeholder,
          selector: i.selector
        })) || [],
        totalLinks: elements.links?.length || 0,
        totalButtons: elements.buttons?.length || 0,
        totalForms: elements.forms?.length || 0,
        totalInputs: elements.inputs?.length || 0
      };

      return {
        data: summary
      };
    } catch (error: any) {
      logger.error('Get page elements failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get page elements: ${error.message}` };
    }
  }

  async scroll(direction: string, amount: number = 500): Promise<ToolResult> {
    try {
      logger.info('Scrolling', { sessionId: this.sessionId, direction, amount });

      const response = await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'scroll',
        direction,
        amount: Math.min(amount, 2000), // Cap scroll amount
        contextId: await this.ensureBrowserContext()
      }, {
        timeout: 10000
      });

      // Get screenshot after scroll
      const pageState = await this.captureCurrentState();

      if (pageState.screenshot) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: {
            url: pageState.url,
            screenshot: pageState.screenshot
          }
        });
      }

      return {
        data: {
          success: true,
          direction,
          amount
        }
      };
    } catch (error: any) {
      logger.error('Scroll failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to scroll: ${error.message}` };
    }
  }

  async goBack(): Promise<ToolResult> {
    try {
      logger.info('Going back', { sessionId: this.sessionId });

      const response = await axios.post(`${this.testExecutorUrl}/api/action`, {
        action: 'goBack',
        contextId: await this.ensureBrowserContext()
      }, {
        timeout: 30000
      });

      // Get updated page state
      const pageState = await this.captureCurrentState();
      this.currentUrl = pageState.url;

      if (pageState.screenshot) {
        emitToSession(this.sessionId, {
          type: 'screenshot',
          data: {
            url: pageState.url,
            screenshot: pageState.screenshot
          }
        });
      }

      return {
        data: {
          success: true,
          url: pageState.url
        }
      };
    } catch (error: any) {
      logger.error('Go back failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to go back: ${error.message}` };
    }
  }

  async wait(milliseconds: number): Promise<ToolResult> {
    const waitTime = Math.min(milliseconds, 10000); // Cap at 10 seconds
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return {
      data: {
        success: true,
        waited: waitTime
      }
    };
  }

  private async captureCurrentState(): Promise<{ url: string; html: string; screenshot?: string }> {
    try {
      const response = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
        captureCurrentPage: true,
        contextId: await this.ensureBrowserContext(),
        includeScreenshot: true
      }, {
        timeout: 30000
      });

      return {
        url: response.data.url,
        html: response.data.html,
        screenshot: response.data.screenshot
      };
    } catch (error: any) {
      logger.error('Failed to capture current state', { error: error.message });
      return { url: this.currentUrl, html: '' };
    }
  }

  async cleanup(): Promise<void> {
    if (this.browserContextId) {
      try {
        await axios.post(`${this.testExecutorUrl}/api/context/close`, {
          contextId: this.browserContextId
        });
      } catch (error: any) {
        logger.warn('Failed to close browser context', { error: error.message });
      }
    }
  }
}
