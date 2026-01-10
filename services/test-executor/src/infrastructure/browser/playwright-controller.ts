import { Browser, BrowserContext, Page, chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('playwright-controller');

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotsDir: string;
  private navigationTimeout: number;
  private navigationMaxTimeout: number;

  constructor(screenshotsDir: string = './screenshots') {
    this.screenshotsDir = screenshotsDir;
    // Ensure screenshots directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    // Disable font loading wait for screenshots to prevent timeouts
    if (!process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY) {
      process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
    }
    // Read timeout configuration from environment
    this.navigationTimeout = parseInt(
      process.env.NAVIGATION_TIMEOUT_MS || '30000',
      10
    );
    this.navigationMaxTimeout = parseInt(
      process.env.NAVIGATION_MAX_TIMEOUT_MS || '60000',
      10
    );
    // Ensure timeouts are within reasonable bounds
    this.navigationTimeout = Math.min(Math.max(this.navigationTimeout, 5000), this.navigationMaxTimeout);
    this.navigationMaxTimeout = Math.min(Math.max(this.navigationMaxTimeout, 10000), 120000);
  }

  async initialize(headless: boolean = true): Promise<void> {
    // In Docker, always use headless mode (no X server available)
    const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
    const actualHeadless = isDocker ? true : headless;

    logger.info('Initializing browser', { requestedHeadless: headless, isDocker, actualHeadless });

    try {
      this.browser = await chromium.launch({
        headless: actualHeadless,
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
          '--disable-component-extensions-with-background-pages',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-sync',
          '--disable-default-apps',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-blink-features=AutomationControlled',
          '--disable-font-subpixel-positioning',
          '--disable-lcd-text',
          '--memory-pressure-off'
        ]
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
      });

      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);
      
      logger.info('Browser initialized successfully');
    } catch (error: any) {
      logger.error('Browser initialization failed', { error: error.message });
      throw error;
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    // Use domcontentloaded for faster navigation (HTML parsed, don't wait for all resources)
    const timeout = this.navigationTimeout;

    try {
      logger.info('Attempting navigation', { url, strategy: 'domcontentloaded', timeout });

      await this.page.goto(url, {
        waitUntil: 'domcontentloaded', // Fast - only wait for HTML to be parsed
        timeout
      });

      // Wait for network to be idle (no requests for 500ms) with short timeout
      // This ensures page is stable for screenshots without waiting too long
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
          // If networkidle times out quickly, page might have continuous requests
          // That's okay, just wait a bit for initial resources
          return this.page!.waitForTimeout(500);
        });
      } catch (e) {
        // Ignore - proceed anyway
      }

      logger.info('Navigation successful', { url });
      return;
    } catch (error: any) {
      // Check if page is still valid after error
      if (!this.page || this.page.isClosed()) {
        if (this.context && this.context.browser()?.isConnected()) {
          try {
            this.page = await this.context.newPage();
            this.page.setDefaultTimeout(30000);
            this.page.setDefaultNavigationTimeout(30000);
            logger.info('Page recreated after navigation error');
          } catch (recoveryError: any) {
            throw new Error(`Failed to recover page: ${recoveryError.message}`);
          }
        } else {
          throw new Error(`Browser context is closed. Cannot recover: ${error.message}`);
        }
      }

      // Check if we're actually on the target URL despite the error
      const currentUrl = this.page.url();
      if (currentUrl.includes(new URL(url).hostname)) {
        logger.info('Navigation succeeded (URL matches despite error)', { url, currentUrl });
        return;
      }

      throw new Error(`Failed to navigate to ${url}: ${error.message}`);
    }
  }

  async takeScreenshot(stepId?: string, skipWait: boolean = false): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    if (this.page.isClosed()) {
      throw new Error('Page is closed, cannot take screenshot.');
    }

    const timestamp = Date.now();
    const filename = stepId
      ? `screenshot-${stepId}-${timestamp}.png`
      : `screenshot-${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    const screenshotTimeout = Math.min(
      Math.max(parseInt(process.env.SCREENSHOT_TIMEOUT_MS || '10000', 10), 5000),
      30000
    );

    try {
      if (this.page.isClosed()) {
        throw new Error('Page is closed, cannot take screenshot.');
      }

      // Only wait for page stability if not explicitly skipped
      // (e.g., after navigation we already waited)
      if (!skipWait) {
        try {
          // Wait for page to be in a stable state before taking screenshot
          // This prevents timeouts when page is still loading
          await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
            // If networkidle times out, try domcontentloaded (faster)
            return this.page!.waitForLoadState('domcontentloaded', { timeout: 1000 });
          }).catch(() => {
            // If both fail, wait a short time for page to stabilize
            return this.page!.waitForTimeout(300);
          });
        } catch (e) {
          // Ignore - proceed with screenshot anyway
        }
      }

      await this.page.screenshot({
        path: filepath,
        fullPage: false,
        timeout: screenshotTimeout,
      });
      return filepath;
    } catch (error: any) {
      const isPageClosedError = error.message?.includes('closed') ||
        error.message?.includes('Target page') ||
        error.message?.includes('browser has been closed');

      if (isPageClosedError) {
        throw new Error('Page is closed, cannot take screenshot.');
      }
      throw error;
    }
  }

  async getPageHTML(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    return await this.page.content();
  }

  async click(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.click(selector, { timeout: 10000 });
  }

  async type(selector: string, text: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.fill(selector, text);
  }

  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForTimeout(ms: number): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.waitForTimeout(ms);
  }

  async scroll(selector?: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    if (selector) {
      await this.page.locator(selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate(() => {
        // @ts-ignore - window exists in browser context
        window.scrollBy(0, 500);
      });
    }
  }

  async hover(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.hover(selector);
  }

  async getElementText(selector: string): Promise<string | null> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    return await this.page.locator(selector).textContent();
  }

  async isVisible(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    try {
      return await this.page.locator(selector).isVisible();
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('Browser closed successfully');
    } catch (error: any) {
      logger.warn('Error during browser close', { error: error.message });
    }
  }

  getPage(): Page | null {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }
    return null;
  }

  /**
   * Ensure page is valid, recover if needed
   */
  async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    if (!this.context) {
      throw new Error('Browser context is not initialized. Cannot recover page.');
    }

    if (!this.context.browser()?.isConnected()) {
      throw new Error('Browser is disconnected. Cannot recover page.');
    }

    logger.info('Page is closed or null, creating new page for recovery');
    try {
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);
      logger.info('New page created successfully for recovery');
      return this.page;
    } catch (error: any) {
      logger.error('Failed to recover page', { error: error.message });
      throw new Error(`Failed to recover page: ${error.message}`);
    }
  }

  /**
   * Get browser context for pooling
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get browser instance for pooling
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Set page from external source (for browser pool)
   */
  setPage(page: Page): void {
    this.page = page;
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);
  }

  /**
   * Set context from external source (for browser pool)
   */
  setContext(context: BrowserContext): void {
    this.context = context;
  }

  /**
   * Set browser from external source (for browser pool)
   */
  setBrowser(browser: Browser): void {
    this.browser = browser;
  }
}
