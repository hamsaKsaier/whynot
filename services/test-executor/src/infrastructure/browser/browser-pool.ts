import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { createLogger } from '../../../shared/logger/logger';
import * as fs from 'fs';

const logger = createLogger('browser-pool');

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
  createdAt: number;
}

/**
 * Browser Pool Manager
 * Pre-initializes browser contexts to eliminate cold start overhead.
 * Automatically recovers from browser disconnections.
 */
export class BrowserPool {
  private static instance: BrowserPool | null = null;
  private browser: Browser | null = null;
  private contexts: PooledContext[] = [];
  private readonly poolSize: number;
  private readonly maxContextAge: number;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor(poolSize: number = 2, maxContextAgeMs: number = 300000) {
    this.poolSize = poolSize;
    this.maxContextAge = maxContextAgeMs; // 5 minutes default
  }

  /**
   * Get singleton instance
   */
  static getInstance(poolSize: number = 2): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(poolSize);
    }
    return BrowserPool.instance;
  }

  /**
   * Check if browser is healthy
   */
  private isBrowserHealthy(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Initialize or re-initialize the browser pool
   */
  async initialize(): Promise<void> {
    // If browser is healthy, nothing to do
    if (this.isBrowserHealthy() && this.contexts.length >= this.poolSize) {
      logger.debug('Browser pool already initialized and healthy');
      return;
    }

    if (this.isInitializing) {
      logger.info('Browser pool initialization in progress, waiting...');
      if (this.initPromise) {
        await this.initPromise;
      }
      return;
    }

    this.isInitializing = true;
    this.initPromise = this._doInitialize();
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  private async _doInitialize(): Promise<void> {
    const isDocker = process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv');
    
    logger.info('Initializing browser pool', { poolSize: this.poolSize, isDocker });

    // Clean up any existing resources
    await this.cleanupExisting();

    try {
      this.browser = await chromium.launch({
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
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--memory-pressure-off'
        ]
      });

      // Pre-create contexts
      for (let i = 0; i < this.poolSize; i++) {
        await this.createPooledContext();
      }

      logger.info('Browser pool initialized successfully', { 
        contextCount: this.contexts.length 
      });
    } catch (error: any) {
      logger.error('Failed to initialize browser pool', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up existing resources before re-initialization
   */
  private async cleanupExisting(): Promise<void> {
    // Close all existing contexts
    for (const pooledContext of this.contexts) {
      try {
        await pooledContext.context.close();
      } catch (e) {
        // Ignore - might already be closed
      }
    }
    this.contexts = [];

    // Close browser if exists
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore
      }
      this.browser = null;
    }
  }

  /**
   * Create a new pooled context
   */
  private async createPooledContext(): Promise<PooledContext> {
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error('Browser not connected');
    }

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    const pooledContext: PooledContext = {
      context,
      inUse: false,
      createdAt: Date.now()
    };

    this.contexts.push(pooledContext);
    return pooledContext;
  }

  /**
   * Acquire a context and page from the pool
   */
  async acquire(): Promise<{ context: BrowserContext; page: Page }> {
    // Check if browser needs re-initialization
    if (!this.isBrowserHealthy()) {
      logger.warn('Browser disconnected, re-initializing pool...');
      await this.initialize();
    }

    // Find an available context that's not too old
    let pooledContext = this.contexts.find(c => {
      if (c.inUse) return false;
      const age = Date.now() - c.createdAt;
      return age < this.maxContextAge;
    });

    // If all contexts are old or in use, try to get any available
    if (!pooledContext) {
      pooledContext = this.contexts.find(c => !c.inUse);
    }

    // If still no context, create a new one or wait
    if (!pooledContext) {
      if (this.contexts.length < this.poolSize * 2) {
        logger.info('Pool exhausted, creating temporary context');
        try {
          pooledContext = await this.createPooledContext();
        } catch (error: any) {
          // Browser might have disconnected, try to reinitialize
          logger.warn('Failed to create context, reinitializing...', { error: error.message });
          await this.initialize();
          pooledContext = this.contexts.find(c => !c.inUse);
          if (!pooledContext) {
            throw new Error('Failed to acquire browser context after reinitialization');
          }
        }
      } else {
        // Wait and retry
        logger.info('Waiting for available context...');
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.acquire();
      }
    }

    // Check if context is too old and needs recycling
    const age = Date.now() - pooledContext.createdAt;
    if (age > this.maxContextAge) {
      logger.info('Recycling old context', { ageMs: age });
      try {
        await this.recycleContext(pooledContext);
        // Get the newly created context
        pooledContext = this.contexts.find(c => !c.inUse);
        if (!pooledContext) {
          throw new Error('No context available after recycling');
        }
      } catch (error: any) {
        logger.warn('Failed to recycle context, reinitializing pool...', { error: error.message });
        await this.initialize();
        pooledContext = this.contexts.find(c => !c.inUse);
        if (!pooledContext) {
          throw new Error('Failed to acquire context after reinitialization');
        }
      }
    }

    pooledContext.inUse = true;

    // Create a fresh page in this context
    try {
      const page = await pooledContext.context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      logger.debug('Context acquired from pool', { 
        activeContexts: this.contexts.filter(c => c.inUse).length,
        totalContexts: this.contexts.length 
      });

      return { context: pooledContext.context, page };
    } catch (error: any) {
      // Failed to create page, mark context as not in use and try again
      pooledContext.inUse = false;
      logger.warn('Failed to create page, reinitializing pool...', { error: error.message });
      await this.initialize();
      // Retry once
      const freshContext = this.contexts.find(c => !c.inUse);
      if (freshContext) {
        freshContext.inUse = true;
        const page = await freshContext.context.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        return { context: freshContext.context, page };
      }
      throw new Error('Failed to acquire browser context: ' + error.message);
    }
  }

  /**
   * Release a context back to the pool
   */
  async release(context: BrowserContext, page: Page): Promise<void> {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }

      const pooledContext = this.contexts.find(c => c.context === context);
      if (pooledContext) {
        pooledContext.inUse = false;
        logger.debug('Context released back to pool');
      }
    } catch (error: any) {
      logger.warn('Error releasing context', { error: error.message });
      await this.removeContext(context);
    }
  }

  /**
   * Recycle a context (close and recreate)
   */
  private async recycleContext(pooledContext: PooledContext): Promise<void> {
    const index = this.contexts.indexOf(pooledContext);
    if (index > -1) {
      this.contexts.splice(index, 1);
      try {
        await pooledContext.context.close();
      } catch (e) {
        // Ignore
      }
      
      // Only create new context if browser is healthy
      if (this.isBrowserHealthy()) {
        await this.createPooledContext();
      } else {
        throw new Error('Browser not connected, cannot create new context');
      }
    }
  }

  /**
   * Remove a context from the pool
   */
  private async removeContext(context: BrowserContext): Promise<void> {
    const index = this.contexts.findIndex(c => c.context === context);
    if (index > -1) {
      this.contexts.splice(index, 1);
      try {
        await context.close();
      } catch (e) {
        // Ignore
      }
      
      // Create replacement if pool is below minimum and browser is healthy
      if (this.contexts.length < this.poolSize && this.isBrowserHealthy()) {
        try {
          await this.createPooledContext();
        } catch (e) {
          // Ignore - will be created on next acquire
        }
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; available: number; inUse: number; healthy: boolean } {
    return {
      total: this.contexts.length,
      available: this.contexts.filter(c => !c.inUse).length,
      inUse: this.contexts.filter(c => c.inUse).length,
      healthy: this.isBrowserHealthy()
    };
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down browser pool');
    await this.cleanupExisting();
    BrowserPool.instance = null;
    logger.info('Browser pool shutdown complete');
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    return this.isBrowserHealthy();
  }

  /**
   * Get browser instance for creating new isolated contexts
   * Ensures browser is initialized before returning
   */
  async getBrowser(): Promise<Browser> {
    await this.initialize();
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error('Browser not available');
    }
    return this.browser;
  }
}

// Graceful shutdown on process exit
process.on('SIGTERM', async () => {
  const pool = BrowserPool.getInstance();
  await pool.shutdown();
});

process.on('SIGINT', async () => {
  const pool = BrowserPool.getInstance();
  await pool.shutdown();
});
