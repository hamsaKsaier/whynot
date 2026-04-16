import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { chromium } from 'playwright';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('playwright-runner');

/**
 * Diagnostics payload captured by the caller (qa-loop-executor) when a
 * test fails. Populated via Chrome DevTools MCP after the Playwright
 * subprocess returns. Enables the self-healing retry flow.
 */
export interface PlaywrightDiagnostics {
  consoleTail?: Array<{ level?: string; text?: string }>;
  failedRequests?: Array<{
    method?: string;
    url?: string;
    status?: number;
    statusText?: string;
  }>;
  capturedAt?: string;
}

export interface PlaywrightRunResult {
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  screenshots: string[];
  duration: number;
  error?: string;
  humanError?: string;
  retryCount?: number;
  /** Populated on failure by the qa-loop-executor caller — see ChromeDevToolsMCP. */
  diagnostics?: PlaywrightDiagnostics;
}

/**
 * Parse Playwright's raw error output into a human-readable message.
 */
export function parsePlaywrightError(rawError: string): string {
  if (!rawError) return 'Test execution failed unexpectedly. Try re-scanning to generate fresh test code.';

  // Strict mode violation — selector matched multiple elements
  if (/strict mode violation/i.test(rawError) || /resolved to \d+ elements/i.test(rawError)) {
    return 'Multiple matching elements found. The selector is too broad — use a more specific selector like page.getByRole() or page.locator("[data-testid=...]").';
  }

  // TimeoutError on locator click
  if (/TimeoutError.*locator\.click/i.test(rawError)) {
    return 'Could not find the element to click. The page may have changed since the test was created.';
  }

  // Element not visible
  if (/not visible/i.test(rawError) || /Error:.*not.*visible/i.test(rawError)) {
    return 'Expected element was not visible on the page.';
  }

  // expect().toBeVisible() (legacy code may still have this)
  if (/Error:.*expect\(received\)\.toBeVisible/i.test(rawError)) {
    return 'Expected element was not visible on the page.';
  }

  // expect().toHaveText()
  if (/Error:.*expect\(received\)\.toHaveText/i.test(rawError)) {
    return 'Page text did not match expected value.';
  }

  // expect().toContainText()
  if (/Error:.*expect\(received\)\.toContainText/i.test(rawError)) {
    return 'Page text did not contain the expected value.';
  }

  // DNS resolution failure
  if (/page\.goto.*net::ERR_NAME_NOT_RESOLVED/i.test(rawError)) {
    return 'Could not reach the website. Check the URL.';
  }

  // Connection refused
  if (/page\.goto.*net::ERR_CONNECTION_REFUSED/i.test(rawError)) {
    return 'Website refused the connection. It may be down.';
  }

  // waitForSelector timeout
  if (/TimeoutError.*page\.waitForSelector/i.test(rawError)) {
    return 'Waited too long for an element to appear. The page may load slowly or have changed.';
  }

  // General timeout
  if (/TimeoutError/i.test(rawError)) {
    return 'Test timed out. The page may be loading slowly or the element was not found.';
  }

  // General assertion failures (throw new Error patterns)
  if (/Error:.*expected/i.test(rawError) || /Error:.*not found/i.test(rawError)) {
    return 'An assertion failed — the page did not match the expected state.';
  }

  // Legacy expect() assertions
  if (/expect\(received\)/i.test(rawError)) {
    return 'An assertion failed — the page did not match the expected state.';
  }

  // Network errors
  if (/net::ERR_/i.test(rawError)) {
    return 'A network error occurred while loading the page.';
  }

  return 'Test execution failed unexpectedly. Try re-scanning to generate fresh test code.';
}

/**
 * Determines if a Playwright failure is an assertion failure (legitimate test result)
 * vs a process/infrastructure crash that should be retried.
 */
function isAssertionFailure(errorMessage: string): boolean {
  return (
    /Error:.*expected/i.test(errorMessage) ||
    /Error:.*not found/i.test(errorMessage) ||
    /Error:.*not visible/i.test(errorMessage) ||
    /Error:.*not.*match/i.test(errorMessage) ||
    /not visible/i.test(errorMessage) ||
    /not shown/i.test(errorMessage) ||
    /not displayed/i.test(errorMessage) ||
    /not present/i.test(errorMessage) ||
    /not found on page/i.test(errorMessage) ||
    /AssertionError/i.test(errorMessage) ||
    /expect\(received\)/i.test(errorMessage) ||
    /strict mode violation/i.test(errorMessage) ||
    /resolved to \d+ elements/i.test(errorMessage)
  );
}

/**
 * Strips any import statements and test()/describe() wrappers from legacy
 * Playwright code, returning only the raw page commands.
 *
 * This handles code that was generated before the prompt change, which
 * includes `import { test, expect } from '@playwright/test'` and wraps
 * commands in `test('...', async ({ page }) => { ... })`.
 */
function stripTestWrapper(code: string): string {
  // Remove import statements
  let stripped = code.replace(/^import\s+.*?;\s*$/gm, '').trim();

  // Remove test('...', async ({ page }) => { ... }) wrapper
  // Match: test('name', async ({ page }) => {
  const testWrapperRegex = /test\s*\([^,]+,\s*async\s*\(\s*\{\s*page[^}]*\}\s*\)\s*=>\s*\{/;
  const match = stripped.match(testWrapperRegex);
  if (match) {
    // Remove the test wrapper opening
    const startIdx = stripped.indexOf(match[0]);
    stripped = stripped.slice(0, startIdx) + stripped.slice(startIdx + match[0].length);

    // Remove the final closing `});`
    const lastClosing = stripped.lastIndexOf('});');
    if (lastClosing !== -1) {
      stripped = stripped.slice(0, lastClosing) + stripped.slice(lastClosing + 3);
    }

    stripped = stripped.trim();
  }

  // Replace expect() calls with throw-based assertions for backward compatibility
  // e.g. await expect(page.locator('.x')).toBeVisible()
  //   -> if (!(await page.locator('.x').isVisible())) throw new Error('Expected element to be visible');
  stripped = stripped.replace(
    /await\s+expect\(([^)]+)\)\.toBeVisible\(\)/g,
    'if (!(await $1.isVisible())) throw new Error(\'Expected element to be visible\')'
  );
  stripped = stripped.replace(
    /await\s+expect\(([^)]+)\)\.toContainText\(['"]([^'"]+)['"]\)/g,
    '{ const __txt = await $1.textContent(); if (!__txt?.includes(\'$2\')) throw new Error(\'Expected text not found: $2\'); }'
  );
  stripped = stripped.replace(
    /await\s+expect\(([^)]+)\)\.toHaveText\(['"]([^'"]+)['"]\)/g,
    '{ const __txt = await $1.textContent(); if (__txt?.trim() !== \'$2\') throw new Error(\'Text mismatch, expected: $2\'); }'
  );

  return stripped;
}

/**
 * Runs raw Playwright commands by launching a browser directly.
 *
 * - Launches a headless Chromium browser via playwright
 * - Creates a new page
 * - Captures before/after/failure screenshots
 * - Executes the raw page commands using AsyncFunction
 * - Retries on process-level crashes (up to 2 retries, NOT on assertion failures)
 * - Parses errors into human-readable messages
 * - Cleans up browser after execution
 */
export interface LoginCredentials {
  loginUrl?: string;
  emailSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  email: string;
  password: string;
}

export async function runPlaywrightCode(
  playwrightCode: string,
  options?: {
    timeoutMs?: number;
    screenshotsDir?: string;
    env?: Record<string, string>;
    credentials?: LoginCredentials;
  }
): Promise<PlaywrightRunResult> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const screenshotsDir = options?.screenshotsDir ?? path.join(os.tmpdir(), 'pw-screenshots');
  const maxRetries = 2;
  let lastResult: PlaywrightRunResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executePlaywrightRun(playwrightCode, {
      timeoutMs,
      screenshotsDir,
      env: options?.env,
      attempt,
      credentials: options?.credentials,
    });

    result.retryCount = attempt;
    lastResult = result;

    // If the test passed, return immediately
    if (result.passed) {
      return result;
    }

    // If this is an assertion failure, don't retry — it's a legitimate test result
    if (result.error && isAssertionFailure(result.error)) {
      logger.info('Assertion failure detected, not retrying', {
        attempt,
        exitCode: result.exitCode,
      });
      return result;
    }

    // If we have retries left, log and continue
    if (attempt < maxRetries) {
      logger.warn('Process-level failure, retrying', {
        attempt: attempt + 1,
        maxRetries,
        exitCode: result.exitCode,
        errorSnippet: (result.error || '').slice(0, 200),
      });
    }
  }

  // Return the last attempt's result
  return lastResult!;
}

/**
 * Execute a single Playwright run by launching chromium directly.
 */
async function executePlaywrightRun(
  playwrightCode: string,
  options: {
    timeoutMs: number;
    screenshotsDir: string;
    env?: Record<string, string>;
    attempt: number;
    credentials?: LoginCredentials;
  }
): Promise<PlaywrightRunResult> {
  const { timeoutMs, screenshotsDir, attempt } = options;
  const runId = uuidv4().slice(0, 8);
  const startTime = Date.now();

  // Screenshot paths for evidence
  const beforeScreenshot = path.join(screenshotsDir, `${runId}-before.png`);
  const afterScreenshot = path.join(screenshotsDir, `${runId}-after.png`);
  const failureScreenshot = path.join(screenshotsDir, `${runId}-failure.png`);

  // Ensure screenshots directory exists
  fs.mkdirSync(screenshotsDir, { recursive: true });

  // Strip any legacy test() wrapper and imports from the code
  const rawCode = stripTestWrapper(playwrightCode);

  // Rewrite screenshot paths in the code to use our screenshots directory
  const rewrittenCode = rawCode.replace(
    /path:\s*['"]([^'"]+)['"]/g,
    (_match: string, originalPath: string) => {
      const filename = path.basename(originalPath);
      return `path: '${path.join(screenshotsDir, `${runId}-${filename}`).replace(/\\/g, '/')}'`;
    }
  );

  // Set environment variables from options
  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      process.env[key] = value;
    }
  }

  let browser = null;

  try {
    logger.info('Launching browser for Playwright execution', { runId, attempt });

    // Launch browser directly
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Set default timeouts
    context.setDefaultTimeout(timeoutMs);
    context.setDefaultNavigationTimeout(timeoutMs);

    const page = await context.newPage();

    // Automatically wait for network idle after every navigation to avoid
    // false-positive assertion failures (cold browser, no cache/cookies).
    page.on('load', async () => {
      await page.waitForLoadState('networkidle').catch(() => {});
    });

    // Capture before screenshot (after first navigation)
    let capturedBefore = false;
    page.on('load', async () => {
      if (!capturedBefore) {
        capturedBefore = true;
        await page.screenshot({ path: beforeScreenshot, fullPage: true }).catch(() => {});
      }
    });

    // Perform login if credentials are provided (establish auth state for cold browser)
    if (options.credentials) {
      const creds = options.credentials;
      const loginUrl = creds.loginUrl || '';
      if (loginUrl) {
        logger.info('Performing login before test execution', { runId, loginUrl });
        await page.goto(loginUrl);
        await page.waitForLoadState('networkidle').catch(() => {});

        const emailSel = creds.emailSelector ||
          'input[type="email"], input[name="email"], input[name="username"], input[type="text"][name*="user"], input[type="text"][name*="email"]';
        const passwordSel = creds.passwordSelector || 'input[type="password"]';
        const submitSel = creds.submitSelector || 'button[type="submit"], input[type="submit"]';

        await page.locator(emailSel).first().fill(creds.email).catch(() => {});
        await page.locator(passwordSel).first().fill(creds.password).catch(() => {});
        await page.locator(submitSel).first().click().catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(2000);
        logger.info('Login completed before test execution', { runId });
      }
    }

    logger.info('Executing raw Playwright commands', { runId, codeLength: rewrittenCode.length, attempt });

    // Build and execute the async function with page in scope
    // Use AsyncFunction constructor to create an async function body
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const testFn = new AsyncFunction('page', 'browser', 'context', rewrittenCode);

    await testFn(page, browser, context);

    // Capture after screenshot on success
    await page.screenshot({ path: afterScreenshot, fullPage: true }).catch(() => {});

    // Collect screenshots
    const screenshots = collectScreenshots(screenshotsDir, runId);
    const duration = Date.now() - startTime;

    logger.info('Playwright execution completed successfully', {
      runId,
      duration,
      screenshots: screenshots.length,
      attempt,
    });

    return {
      passed: true,
      exitCode: 0,
      stdout: 'Test passed',
      stderr: '',
      screenshots,
      duration,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const rawError = (err.message || String(err)).slice(0, 2000);

    logger.info('Playwright execution failed', {
      runId,
      duration,
      error: rawError.slice(0, 200),
      attempt,
    });

    // Try to capture failure screenshot if browser is still alive
    if (browser) {
      try {
        const pages = browser.contexts()?.[0]?.pages();
        if (pages && pages.length > 0) {
          await pages[0].screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
        }
      } catch {
        // Browser may already be closed
      }
    }

    const screenshots = collectScreenshots(screenshotsDir, runId);

    return {
      passed: false,
      exitCode: 1,
      stdout: '',
      stderr: rawError,
      screenshots,
      duration,
      error: rawError,
      humanError: parsePlaywrightError(rawError),
    };
  } finally {
    // Always close browser
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Collect screenshot files matching the runId from the screenshots directory.
 */
function collectScreenshots(screenshotsDir: string, runId: string): string[] {
  const screenshots: string[] = [];
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const file of files) {
      if (file.startsWith(runId) && (file.endsWith('.png') || file.endsWith('.jpg'))) {
        screenshots.push(path.join(screenshotsDir, file));
      }
    }
  }
  return screenshots;
}
