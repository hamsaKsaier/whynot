/**
 * k6-runner.ts
 *
 * Spawns k6 processes and streams results via WebSocket.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../../../shared/logger/logger';
import { K6MetricsAggregator, K6Summary } from './k6-parser';
import { generateK6Script, PerfTestConfig } from './k6-script-generator';

const logger = createLogger('k6-runner');

/** Track active k6 processes so they can be stopped */
const activeProcesses = new Map<string, ChildProcess>();

export interface K6RunCallbacks {
  onMetric: (metric: any) => void;
  onComplete: (summary: K6Summary) => void;
  onError: (error: string) => void;
}

/**
 * Run a k6 performance test.
 */
export async function runK6Test(
  runId: string,
  config: PerfTestConfig,
  callbacks: K6RunCallbacks,
): Promise<K6Summary> {
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `k6-script-${runId}.js`);
  const jsonOutputPath = path.join(tmpDir, `k6-results-${runId}.json`);

  // Generate k6 script and log it for debugging
  const script = generateK6Script(config);
  fs.writeFileSync(scriptPath, script, 'utf-8');
  logger.info('Generated k6 script', { runId, scriptPath, scriptContent: script });

  const aggregator = new K6MetricsAggregator();

  return new Promise((resolve, reject) => {
    const k6Args = [
      'run',
      '--out', `json=${jsonOutputPath}`,
      scriptPath,
    ];

    logger.info('Spawning k6 process', { runId, args: k6Args });

    // Only pass safe env vars to k6 — never leak secrets like API keys or JWT_SECRET
    const safeEnv: Record<string, string> = {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: process.env.HOME || '/tmp',
      TERM: process.env.TERM || 'xterm',
    };

    const proc = spawn('k6', k6Args, {
      env: safeEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    activeProcesses.set(runId, proc);

    // Collect all stderr for error reporting
    let stderrFull = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutBuffer += text;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        aggregator.parseStdoutLine(line);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrFull += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        // k6 outputs progress info to stderr
        aggregator.parseStdoutLine(line);
        // Log stderr lines for debugging
        logger.debug('k6 stderr', { runId, line });
      }
    });

    // Stream metrics from JSON output in real-time
    let jsonReadOffset = 0;
    const jsonStreamInterval = setInterval(() => {
      try {
        if (!fs.existsSync(jsonOutputPath)) return;
        const content = fs.readFileSync(jsonOutputPath, 'utf-8');
        const newContent = content.slice(jsonReadOffset);
        jsonReadOffset = content.length;

        const lines = newContent.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const metric = aggregator.parseLine(line);
          if (metric) {
            callbacks.onMetric(metric);
          }
        }
      } catch {
        // File might not exist yet or be locked — skip this tick
      }
    }, 1000);

    proc.on('close', (code) => {
      clearInterval(jsonStreamInterval);
      activeProcesses.delete(runId);

      logger.info('k6 process exited', { runId, code, stderrLength: stderrFull.length });

      // Log full stderr on non-zero exit for debugging
      if (code !== 0 && code !== 99) {
        logger.error('k6 failed — full stderr output', { runId, code, stderr: stderrFull });
        logger.error('k6 failed — script content was', { runId, script });
      }

      // Parse any remaining JSON output
      try {
        if (fs.existsSync(jsonOutputPath)) {
          const content = fs.readFileSync(jsonOutputPath, 'utf-8');
          const remaining = content.slice(jsonReadOffset);
          for (const line of remaining.split('\n')) {
            if (line.trim()) aggregator.parseLine(line);
          }
        }
      } catch { /* ignore */ }

      // Emit final snapshot
      const finalMetric = aggregator.getCurrentSnapshot();
      callbacks.onMetric(finalMetric);

      // Cleanup temp files
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
      try { fs.unlinkSync(jsonOutputPath); } catch { /* ignore */ }

      const summary = aggregator.getSummary();

      if (code === 0 || code === 99) {
        logger.info('k6 test completed', { runId, code });
        callbacks.onComplete(summary);
        resolve(summary);
      } else {
        const errorMsg = `k6 exited with code ${code}: ${stderrFull.slice(0, 500)}`;
        logger.error('k6 test failed', { runId, code });
        callbacks.onError(errorMsg);
        callbacks.onComplete(summary);
        resolve(summary);
      }
    });

    proc.on('error', (err) => {
      clearInterval(jsonStreamInterval);
      activeProcesses.delete(runId);
      // Cleanup temp files on spawn error
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
      try { fs.unlinkSync(jsonOutputPath); } catch { /* ignore */ }
      const errorMsg = `Failed to spawn k6: ${err.message}`;
      logger.error(errorMsg, { runId });
      callbacks.onError(errorMsg);
      reject(new Error(errorMsg));
    });
  });
}

/**
 * Stop a running k6 test.
 */
export function stopK6Test(runId: string): boolean {
  const proc = activeProcesses.get(runId);
  if (!proc) {
    logger.warn('No active k6 process found', { runId });
    return false;
  }

  logger.info('Stopping k6 test', { runId });
  proc.kill('SIGTERM');
  activeProcesses.delete(runId);
  return true;
}

/**
 * Check if a k6 test is currently running.
 */
export function isK6TestRunning(runId: string): boolean {
  return activeProcesses.has(runId);
}

/**
 * Stop all running k6 tests (for graceful shutdown).
 */
export function stopAllK6Tests(): void {
  for (const [runId, proc] of activeProcesses) {
    logger.info('Stopping k6 test during shutdown', { runId });
    proc.kill('SIGTERM');
  }
  activeProcesses.clear();
}
