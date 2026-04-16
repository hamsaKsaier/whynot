import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { chromium } from 'playwright';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('playwright-runner');

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
  // Outer belt-and-suspenders timeout: executePlaywrightRun has its own
  // hard-deadline inside the test body, but if the browser LAUNCH hangs or
  // the finally-block's graceful close hangs, nothing else would stop it.
  // This outer Promise.race guarantees runPlaywrightCode returns within
  // hardTimeoutMs no matter what the Playwright subprocess is doing.
  const hardTimeoutMs = timeoutMs + 15_000; // 45s absolute ceiling
  const screenshotsDir = options?.screenshotsDir ?? path.join(os.tmpdir(), 'pw-screenshots');
  const maxRetries = 2;
  let lastResult: PlaywrightRunResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let hardTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result: PlaywrightRunResult = await Promise.race([
        executePlaywrightRun(playwrightCode, {
          timeoutMs,
          screenshotsDir,
          env: options?.env,
          attempt,
          credentials: options?.credentials,
        }),
        new Promise<PlaywrightRunResult>((_, reject) => {
          hardTimer = setTimeout(
            () => reject(new Error(`HARD_TIMEOUT_${hardTimeoutMs}ms_subprocess_killed`)),
            hardTimeoutMs,
          );
        }),
      ]);

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
    } catch (err: any) {
      // HARD_TIMEOUT fired — subprocess was force-killed. Return a clean
      // failure result rather than propagating the exception; no more retries.
      if (err.message?.startsWith('HARD_TIMEOUT_')) {
        logger.error('Hard timeout fired — Playwright subprocess force-killed', {
          attempt,
          hardTimeoutMs,
        });
        return {
          passed: false,
          exitCode: -1,
          stdout: '',
          stderr: err.message,
          screenshots: [],
          duration: hardTimeoutMs,
          error: 'Test timed out — subprocess was force-killed',
          humanError: 'Test execution hung and was forcibly terminated. Likely a bad selector or infinite wait.',
          retryCount: attempt,
        };
      }
      throw err;
    } finally {
      if (hardTimer) clearTimeout(hardTimer);
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

    // Launch browser directly. 20s launch cap — if chromium itself hangs
    // starting up, fail fast and let the retry loop try again.
    browser = await chromium.launch({
      headless: true,
      timeout: 20_000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Tighter operation-level timeouts than the overall `timeoutMs` budget.
    // Individual action stalls get detected in seconds, not at the end of
    // the run. The outer Promise.race in runPlaywrightCode is the final
    // safety net if these individual caps don't fire.
    context.setDefaultTimeout(Math.min(timeoutMs, 8_000));
    context.setDefaultNavigationTimeout(Math.min(timeoutMs, 12_000));

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
    // Always close browser. If graceful close hangs (known failure mode
    // when a crashed page holds a mutex), race a 5s deadline and then
    // SIGKILL the underlying chromium subprocess. Without this, a hung
    // close() blocks the entire runPlaywrightCode return path.
    if (browser) {
      try {
        await Promise.race([
          browser.close(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('browser_close_timeout_5s')), 5000),
          ),
        ]);
      } catch (closeErr: any) {
        logger.warn('browser.close() stalled — force-killing chromium subprocess', {
          error: closeErr?.message,
        });
        try {
          const browserProcess: any = (browser as any)._process;
          if (browserProcess && typeof browserProcess.kill === 'function' && !browserProcess.killed) {
            browserProcess.kill('SIGKILL');
          }
        } catch {
          // final fallback — nothing else we can do
        }
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
