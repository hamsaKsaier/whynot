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
    // This significantly improves screenshot performance
    if (!process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY) {
      process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
    }
    // Read timeout configuration from environment
    this.navigationTimeout = parseInt(
      process.env.NAVIGATION_TIMEOUT_MS || '60000',
      10
    );
    this.navigationMaxTimeout = parseInt(
      process.env.NAVIGATION_MAX_TIMEOUT_MS || '120000',
      10
    );
    // Ensure timeouts are within reasonable bounds
    this.navigationTimeout = Math.min(Math.max(this.navigationTimeout, 10000), this.navigationMaxTimeout);
    this.navigationMaxTimeout = Math.min(Math.max(this.navigationMaxTimeout, 30000), 300000);
  }

  async initialize(headless: boolean = true): Promise<void> {
    // In Docker, always use headless mode (no X server available)
    // But we can still capture frames for live preview streaming
    // The "headless" parameter here is for whether to show a window,
    // but we always run headless in Docker and stream frames instead
    const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
    // ALWAYS use headless in Docker - no exceptions
    const actualHeadless = isDocker ? true : headless;

    // Log for debugging
    console.log('[PlaywrightController] initialize called', {
      requestedHeadless: headless,
      isDocker,
      actualHeadless
    });

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
        '--disable-ipc-flooding-protection'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    this.page = await this.context.newPage();
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const waitStrategies: Array<'domcontentloaded' | 'load' | 'networkidle'> = [
      'domcontentloaded',
      'load',
      'networkidle'
    ];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < waitStrategies.length; attempt++) {
      const strategy = waitStrategies[attempt];
      // Use progressively shorter timeouts for fallback strategies
      const timeout = attempt === 0
        ? this.navigationTimeout
        : Math.max(this.navigationTimeout / 2, 30000);

      try {
        logger.info('Attempting navigation', {
          url,
          strategy,
          timeout,
          attempt: attempt + 1,
          totalAttempts: waitStrategies.length
        });

        await this.page.goto(url, {
          waitUntil: strategy,
          timeout
        });

        // Wait a bit for any dynamic content
        await this.page.waitForTimeout(2000);

        logger.info('Navigation successful', {
          url,
          strategy,
          attempt: attempt + 1
        });

        return; // Success, exit early
      } catch (error: any) {
        lastError = error;
        logger.warn('Navigation attempt failed', {
          url,
          strategy,
          timeout,
          attempt: attempt + 1,
          error: error.message
        });

        // If this is not the last strategy, continue to next
        if (attempt < waitStrategies.length - 1) {
          logger.info('Trying next wait strategy', {
            nextStrategy: waitStrategies[attempt + 1]
          });
          continue;
        }
      }
    }

    // All strategies failed
    const errorMessage = `Failed to navigate to ${url} after trying all wait strategies (domcontentloaded, load, networkidle). ` +
      `Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Timeout used: ${this.navigationTimeout}ms. ` +
      `The page may be loading too slowly or there may be network issues.`;

    logger.error('Navigation failed after all attempts', {
      url,
      lastError: lastError?.message,
      timeout: this.navigationTimeout
    });

    throw new Error(errorMessage);
  }

  async takeScreenshot(stepId?: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    // Check if page is closed
    if (this.page.isClosed()) {
      throw new Error('Page is closed, cannot take screenshot.');
    }

    const timestamp = Date.now();
    const filename = stepId
      ? `screenshot-${stepId}-${timestamp}.png`
      : `screenshot-${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    // Configurable screenshot timeout (default: 60s, max: 120s)
    const screenshotTimeout = Math.min(
      Math.max(parseInt(process.env.SCREENSHOT_TIMEOUT_MS || '60000', 10), 10000),
      120000
    );

    try {
      // Capture screenshot with explicit timeout passed directly to Playwright
      await this.page.screenshot({
        path: filepath,
        fullPage: false,
        timeout: screenshotTimeout,
      });
      return filepath;
    } catch (error: any) {
      // Check if page became closed during screenshot
      if (this.page.isClosed()) {
        throw new Error('Page closed during screenshot capture.');
      }
      // Re-throw timeout or other errors
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
  }

  getPage(): Page | null {
    return this.page;
  }
}

