import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { createLogger } from '../../../shared/logger/logger';
import * as fs from 'fs';

const logger = createLogger('browser-session-manager');

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Manages persistent browser sessions for QA Loop
 * Keeps browser contexts alive across multiple requests to maintain login state
 */
export class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly screenshotsDir: string;

  constructor(screenshotsDir: string = './screenshots') {
    this.screenshotsDir = screenshotsDir;
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 60000);
  }

  /**
   * Create a new browser session or return existing one
   */
  async getOrCreateSession(sessionId: string): Promise<BrowserSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      // Check if browser is still connected
      if (existing.browser.isConnected() && !existing.page.isClosed()) {
        existing.lastUsedAt = new Date();
        return existing;
      } else {
        // Clean up disconnected session
        await this.closeSession(sessionId);
      }
    }

    // Create new session
    logger.info('Creating new browser session', { sessionId });

    const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled',
        '--memory-pressure-off'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    const session: BrowserSession = {
      browser,
      context,
      page,
      createdAt: new Date(),
      lastUsedAt: new Date()
    };

    this.sessions.set(sessionId, session);
    logger.info('Browser session created', { sessionId, totalSessions: this.sessions.size });

    return session;
  }

  /**
   * Get an existing session (returns null if not found)
   */
  getSession(sessionId: string): BrowserSession | null {
    const session = this.sessions.get(sessionId);
    if (session && session.browser.isConnected() && !session.page.isClosed()) {
      session.lastUsedAt = new Date();
      return session;
    }
    return null;
  }

  /**
   * Close and cleanup a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.page.close().catch(() => {});
        await session.context.close().catch(() => {});
        await session.browser.close().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }
      this.sessions.delete(sessionId);
      logger.info('Browser session closed', { sessionId, remainingSessions: this.sessions.size });
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(sessionId: string, url: string): Promise<{ url: string; title: string; html: string; screenshot?: string }> {
    const session = await this.getOrCreateSession(sessionId);

    await session.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to stabilize
    await session.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await session.page.waitForTimeout(500);

    const currentUrl = session.page.url();
    const title = await session.page.title();
    const html = await session.page.content();
    const screenshot = await this.takeScreenshot(session);

    return { url: currentUrl, title, html, screenshot };
  }

  /**
   * Click an element
   */
  async click(sessionId: string, selector: string): Promise<{ success: boolean; newUrl: string; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, newUrl: '', error: 'Session not found' };
    }

    try {
      const prevUrl = session.page.url();

      // Try multiple selector strategies
      const clicked = await this.clickWithFallback(session.page, selector);
      if (!clicked) {
        return { success: false, newUrl: prevUrl, error: `Element not found: ${selector}` };
      }

      // Wait for potential navigation or DOM changes
      await session.page.waitForTimeout(1000);
      await session.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

      return { success: true, newUrl: session.page.url() };
    } catch (error: any) {
      return { success: false, newUrl: session.page.url(), error: error.message };
    }
  }

  /**
   * Try multiple selector strategies for clicking
   */
  private async clickWithFallback(page: Page, selector: string): Promise<boolean> {
    // Strategy 1: Direct selector
    try {
      await page.click(selector, { timeout: 5000 });
      return true;
    } catch (e) {
      // Continue to next strategy
    }

    // Strategy 2: Text-based selector (for buttons with text like "Log in", "Sign in")
    if (selector.includes(':contains(')) {
      const textMatch = selector.match(/:contains\("([^"]+)"\)/);
      if (textMatch) {
        try {
          await page.getByRole('button', { name: textMatch[1] }).click({ timeout: 5000 });
          return true;
        } catch (e) {
          // Try link with same text
          try {
            await page.getByRole('link', { name: textMatch[1] }).click({ timeout: 5000 });
            return true;
          } catch (e2) {
            // Continue
          }
        }
      }
    }

    // Strategy 3: For submit buttons
    if (selector.includes('submit')) {
      try {
        await page.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 5000 });
        return true;
      } catch (e) {
        // Continue
      }
    }

    // Strategy 4: Visible button/link with common login text
    const loginTexts = ['Log in', 'Login', 'Sign in', 'Signin', 'Submit', 'Continue'];
    for (const text of loginTexts) {
      try {
        const btn = page.getByRole('button', { name: new RegExp(text, 'i') });
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click({ timeout: 3000 });
          return true;
        }
      } catch (e) {
        // Continue
      }
    }

    return false;
  }

  /**
   * Type text into an element
   */
  async type(sessionId: string, selector: string, text: string, clearFirst: boolean = true): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      const typed = await this.typeWithFallback(session.page, selector, text, clearFirst);
      if (!typed) {
        return { success: false, error: `Input not found: ${selector}` };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Try multiple selector strategies for typing
   */
  private async typeWithFallback(page: Page, selector: string, text: string, clearFirst: boolean): Promise<boolean> {
    // Strategy 1: Direct selector
    try {
      if (clearFirst) {
        await page.fill(selector, text, { timeout: 5000 });
      } else {
        await page.locator(selector).pressSequentially(text, { timeout: 5000 });
      }
      return true;
    } catch (e) {
      // Continue to next strategy
    }

    // Strategy 2: Common email/username selectors
    if (selector.includes('email') || selector.includes('username') || selector.includes('user')) {
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[id="email"]',
        'input[id="username"]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]'
      ];

      for (const sel of emailSelectors) {
        try {
          const input = page.locator(sel).first();
          if (await input.isVisible({ timeout: 1000 })) {
            await input.fill(text, { timeout: 3000 });
            return true;
          }
        } catch (e) {
          // Continue
        }
      }
    }

    // Strategy 3: Password selector
    if (selector.includes('password')) {
      try {
        const input = page.locator('input[type="password"]').first();
        if (await input.isVisible({ timeout: 2000 })) {
          await input.fill(text, { timeout: 3000 });
          return true;
        }
      } catch (e) {
        // Continue
      }
    }

    return false;
  }

  /**
   * Scroll the page
   */
  async scroll(sessionId: string, direction: string, amount: number): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      const scrollAmount = direction === 'up' ? -amount : amount;
      await session.page.evaluate(`window.scrollBy(0, ${scrollAmount})`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Go back in history
   */
  async goBack(sessionId: string): Promise<{ success: boolean; url: string; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, url: '', error: 'Session not found' };
    }

    try {
      await session.page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await session.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      return { success: true, url: session.page.url() };
    } catch (error: any) {
      return { success: false, url: session.page.url(), error: error.message };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(session: BrowserSession): Promise<string> {
    try {
      const buffer = await session.page.screenshot({ fullPage: false });
      return buffer.toString('base64');
    } catch (error: any) {
      logger.warn('Failed to take screenshot', { error: error.message });
      return '';
    }
  }

  /**
   * Get screenshot for a session
   */
  async getScreenshot(sessionId: string): Promise<{ screenshot: string; url: string; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { screenshot: '', url: '', error: 'Session not found' };
    }

    const screenshot = await this.takeScreenshot(session);
    return { screenshot, url: session.page.url() };
  }

  /**
   * Capture current page state
   */
  async captureState(sessionId: string): Promise<{ url: string; title: string; html: string; screenshot: string; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { url: '', title: '', html: '', screenshot: '', error: 'Session not found' };
    }

    try {
      const url = session.page.url();
      const title = await session.page.title();
      const html = await session.page.content();
      const screenshot = await this.takeScreenshot(session);

      return { url, title, html, screenshot };
    } catch (error: any) {
      return { url: '', title: '', html: '', screenshot: '', error: error.message };
    }
  }

  /**
   * Detect interactive elements on the page
   */
  async detectElements(sessionId: string): Promise<any> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    try {
      const elements = await session.page.evaluate(`
        (() => {
          const links = [];
          const buttons = [];
          const inputs = [];
          const forms = [];

          // Get links
          document.querySelectorAll('a[href]').forEach((el, idx) => {
            if (el.offsetParent !== null) {
              links.push({
                text: (el.textContent || '').trim().substring(0, 100),
                href: el.href,
                selector: 'a[href="' + el.href + '"]'
              });
            }
          });

          // Get buttons
          document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach((el, idx) => {
            if (el.offsetParent !== null) {
              buttons.push({
                text: (el.textContent || el.value || '').trim().substring(0, 100),
                selector: el.id ? '#' + el.id : 'button:nth-of-type(' + (idx + 1) + ')'
              });
            }
          });

          // Get inputs
          document.querySelectorAll('input, textarea, select').forEach((el, idx) => {
            if (el.offsetParent !== null && el.type !== 'hidden') {
              inputs.push({
                type: el.type || 'text',
                name: el.name || '',
                placeholder: el.placeholder || '',
                selector: el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : 'input:nth-of-type(' + (idx + 1) + ')')
              });
            }
          });

          // Get forms
          document.querySelectorAll('form').forEach((el, idx) => {
            forms.push({
              action: el.action || '',
              method: el.method || 'get',
              fields: Array.from(el.elements).filter(e => e.type !== 'hidden').length
            });
          });

          return { links, buttons, inputs, forms };
        })()
      `);

      return elements;
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Cleanup stale sessions
   */
  private async cleanupStaleSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.lastUsedAt.getTime();
      if (age > this.SESSION_TIMEOUT_MS || !session.browser.isConnected()) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      logger.info('Cleaning up stale session', { sessionId });
      await this.closeSession(sessionId);
    }
  }

  /**
   * Close all sessions and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }

    logger.info('Browser session manager shutdown complete');
  }
}

// Singleton instance
export const browserSessionManager = new BrowserSessionManager(
  process.env.SCREENSHOTS_DIR || './screenshots'
);
