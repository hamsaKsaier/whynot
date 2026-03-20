import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
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

  // TimeoutError on locator click
  if (/TimeoutError.*locator\.click/i.test(rawError)) {
    return 'Could not find the element to click. The page may have changed since the test was created.';
  }

  // expect().toBeVisible()
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

  // General assertion failures
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
function isAssertionFailure(stderr: string, stdout: string): boolean {
  const combined = `${stderr} ${stdout}`;
  return (
    /expect\(received\)/i.test(combined) ||
    /Error:.*expect\(/i.test(combined) ||
    /AssertionError/i.test(combined) ||
    // Playwright reports assertion failures with specific exit code patterns
    /\d+ failed/i.test(combined)
  );
}

/**
 * Runs a Playwright code string as a standalone .spec.ts file.
 *
 * - Writes the code to a temp directory
 * - Wraps the test with automatic screenshot capture (before/after/failure)
 * - Executes it via `npx playwright test`
 * - Retries on process-level crashes (up to 2 retries, NOT on assertion failures)
 * - Parses errors into human-readable messages
 * - Captures pass/fail, screenshots, and output
 * - Cleans up temp files after execution
 */
export async function runPlaywrightCode(
  playwrightCode: string,
  options?: {
    timeoutMs?: number;
    screenshotsDir?: string;
    env?: Record<string, string>;
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
    });

    result.retryCount = attempt;
    lastResult = result;

    // If the test passed, return immediately
    if (result.passed) {
      return result;
    }

    // If this is an assertion failure, don't retry — it's a legitimate test result
    if (isAssertionFailure(result.stderr, result.stdout)) {
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
 * Execute a single Playwright run (used internally by runPlaywrightCode for retry logic).
 */
async function executePlaywrightRun(
  playwrightCode: string,
  options: {
    timeoutMs: number;
    screenshotsDir: string;
    env?: Record<string, string>;
    attempt: number;
  }
): Promise<PlaywrightRunResult> {
  const { timeoutMs, screenshotsDir, attempt } = options;
  const runId = uuidv4().slice(0, 8);
  const tmpDir = path.join(os.tmpdir(), `pw-run-${runId}`);
  const specFile = path.join(tmpDir, `test-${runId}.spec.ts`);
  const startTime = Date.now();

  // Screenshot paths for evidence wrapper
  const beforeScreenshot = path.join(screenshotsDir, `${runId}-before.png`);
  const afterScreenshot = path.join(screenshotsDir, `${runId}-after.png`);
  const failureScreenshot = path.join(screenshotsDir, `${runId}-failure.png`);

  try {
    // Create temp directory and screenshots directory
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Rewrite screenshot paths in the code to use our screenshots directory
    const rewrittenCode = playwrightCode.replace(
      /path:\s*['"]([^'"]+)['"]/g,
      (_match, originalPath) => {
        const filename = path.basename(originalPath);
        return `path: '${path.join(screenshotsDir, `${runId}-${filename}`)}'`;
      }
    );

    // Wrap the user's code with screenshot evidence capture
    const wrappedCode = wrapWithScreenshotEvidence(
      rewrittenCode,
      beforeScreenshot,
      afterScreenshot,
      failureScreenshot
    );

    // Write the spec file
    fs.writeFileSync(specFile, wrappedCode, 'utf-8');

    // Write a minimal Playwright config for the temp run
    const configContent = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: ${timeoutMs},
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    actionTimeout: ${timeoutMs},
    navigationTimeout: ${timeoutMs},
  },
  reporter: [['list']],
});
`;
    fs.writeFileSync(path.join(tmpDir, 'playwright.config.ts'), configContent, 'utf-8');

    logger.info('Running Playwright test', { runId, specFile, attempt });

    // Build environment variables
    // Set NODE_PATH so that modules installed in /app/node_modules are resolvable
    // from the temp directory where Playwright tests run
    const appNodeModules = path.resolve(__dirname, '..', '..', '..', 'node_modules');
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...(options?.env ?? {}),
      NODE_PATH: [appNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    };

    // Run Playwright
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      stdout = execSync(
        `npx playwright test "${specFile}" --config "${path.join(tmpDir, 'playwright.config.ts')}"`,
        {
          cwd: tmpDir,
          timeout: timeoutMs + 5_000, // extra buffer for process startup
          env,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
    } catch (err: any) {
      exitCode = err.status ?? 1;
      stdout = err.stdout ?? '';
      stderr = err.stderr ?? '';
    }

    // Collect screenshots
    const screenshots: string[] = [];
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      for (const file of files) {
        if (file.startsWith(runId) && (file.endsWith('.png') || file.endsWith('.jpg'))) {
          screenshots.push(path.join(screenshotsDir, file));
        }
      }
    }

    const duration = Date.now() - startTime;
    const passed = exitCode === 0;
    const rawError = passed ? undefined : (stderr || stdout).slice(0, 2000);
    const humanError = rawError ? parsePlaywrightError(rawError) : undefined;

    logger.info('Playwright test completed', {
      runId,
      passed,
      exitCode,
      duration,
      screenshots: screenshots.length,
      attempt,
    });

    return {
      passed,
      exitCode,
      stdout,
      stderr,
      screenshots,
      duration,
      error: rawError,
      humanError,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logger.error('Playwright runner error', { runId, error: err.message, attempt });

    const rawError = err.message;
    return {
      passed: false,
      exitCode: 1,
      stdout: '',
      stderr: rawError,
      screenshots: [],
      duration,
      error: rawError,
      humanError: parsePlaywrightError(rawError),
    };
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Wraps user Playwright code with automatic screenshot evidence capture.
 *
 * Detects the test body and injects:
 *   - A "before" screenshot at test start
 *   - An "after" screenshot at test end
 *   - A "failure" screenshot on any error
 */
function wrapWithScreenshotEvidence(
  code: string,
  beforePath: string,
  afterPath: string,
  failurePath: string
): string {
  // Find the pattern: test('...', async ({ page ... }) => {
  // and wrap the body with screenshot logic
  const testBodyRegex = /(test\s*\([^,]+,\s*async\s*\(\s*\{\s*page[^}]*\}\s*\)\s*=>\s*\{)/;
  const match = code.match(testBodyRegex);

  if (!match) {
    // If we can't find the test body pattern, return unchanged
    // (the code might use a different pattern)
    return code;
  }

  const escapedBefore = beforePath.replace(/\\/g, '\\\\');
  const escapedAfter = afterPath.replace(/\\/g, '\\\\');
  const escapedFailure = failurePath.replace(/\\/g, '\\\\');

  // Insert screenshot wrapper after the test opening brace
  const wrappedCode = code.replace(
    testBodyRegex,
    `$1\n  // --- Screenshot evidence wrapper (auto-injected) ---\n  await page.screenshot({ path: '${escapedBefore}', fullPage: true }).catch(() => {});\n  try {\n`
  );

  // Find the last closing of the test: the final `});`
  // We need to insert the after screenshot + catch before the final });
  const lastClosingIdx = wrappedCode.lastIndexOf('});');
  if (lastClosingIdx === -1) {
    return wrappedCode;
  }

  const beforeClose = wrappedCode.slice(0, lastClosingIdx);
  const afterClose = wrappedCode.slice(lastClosingIdx);

  return `${beforeClose}\n    await page.screenshot({ path: '${escapedAfter}', fullPage: true }).catch(() => {});\n  } catch (__screenshotWrapErr) {\n    await page.screenshot({ path: '${escapedFailure}', fullPage: true }).catch(() => {});\n    throw __screenshotWrapErr;\n  }\n${afterClose}`;
}
