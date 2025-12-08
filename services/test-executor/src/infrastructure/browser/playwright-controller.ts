import { Browser, BrowserContext, Page, chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotsDir: string;

  constructor(screenshotsDir: string = './screenshots') {
    this.screenshotsDir = screenshotsDir;
    // Ensure screenshots directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
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
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      // Wait a bit for any dynamic content
      await this.page.waitForTimeout(2000);
    } catch (error: any) {
      // If networkidle fails, try with domcontentloaded
      if (error.message?.includes('networkidle')) {
        await this.page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
      } else {
        throw error;
      }
    }
  }

  async takeScreenshot(stepId?: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    const timestamp = Date.now();
    const filename = stepId 
      ? `screenshot-${stepId}-${timestamp}.png`
      : `screenshot-${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    await this.page.screenshot({ path: filepath, fullPage: false });
    return filepath;
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

