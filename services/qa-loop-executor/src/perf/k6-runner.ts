/**
 * k6-runner.ts
 *
 * Spawns k6 processes and streams results via WebSocket.
 * Uses stdout JSON streaming (--out json=-) instead of file-based polling.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../../../shared/logger/logger';
import { K6MetricsAggregator, K6Summary } from './k6-parser';
import { generateK6Script, PerfTestConfig } from './k6-script-generator';

const logger = createLogger('k6-runner');

const activeProcesses = new Map<string, ChildProcess>();

export interface K6RunCallbacks {
  onMetric: (metric: any) => void;
  onComplete: (summary: K6Summary) => void;
  onError: (error: string) => void;
}

export async function runK6Test(
  runId: string,
  config: PerfTestConfig,
  callbacks: K6RunCallbacks,
): Promise<K6Summary> {
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `k6-script-${runId}.js`);

  const script = generateK6Script(config);
  fs.writeFileSync(scriptPath, script, 'utf-8');
  logger.info('k6 script generated', { runId, scriptLength: script.length });
  logger.info('k6 script content', { runId, script });

  const aggregator = new K6MetricsAggregator();

  return new Promise((resolve, reject) => {
    // Use --out json=- to stream JSON to stdout (instead of file-based polling)
    const k6Args = ['run', '--out', 'json=-', scriptPath];

    logger.info('Spawning k6', { runId, args: k6Args });

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
    logger.info('k6 spawned', { runId, pid: proc.pid });

    let stderrFull = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let linesProcessed = 0;
    let metricsEmitted = 0;

    // ── STDOUT: JSON metric lines from --out json=- ──────────────────
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // keep incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;
        linesProcessed++;

        const metric = aggregator.parseLine(line);
        if (metric) {
          metricsEmitted++;
          callbacks.onMetric(metric);
        }
      }

      // Force-emit a snapshot every chunk to guarantee updates reach frontend
      const snapshot = aggregator.getCurrentSnapshot();
      if (snapshot.requests > 0 || snapshot.vus > 0) {
        callbacks.onMetric(snapshot);
        metricsEmitted++;
      }
    });

    // ── STDERR: k6 progress info + final summary ──────────────────────
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrFull += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        aggregator.parseStdoutLine(line);
      }
    });

    // ── Periodic progress logging ─────────────────────────────────────
    const logInterval = setInterval(() => {
      logger.info('k6 progress', {
        runId,
        linesProcessed,
        metricsEmitted,
        snapshot: aggregator.getCurrentSnapshot(),
      });
    }, 5000);

    // ── Process exit ──────────────────────────────────────────────────
    proc.on('close', (code) => {
      clearInterval(logInterval);
      activeProcesses.delete(runId);

      logger.info('k6 exited', { runId, code, linesProcessed, metricsEmitted });

      if (code !== 0 && code !== 99) {
        logger.error('k6 stderr', { runId, code, stderr: stderrFull.slice(0, 2000) });
      }

      // Final snapshot
      const finalMetric = aggregator.getCurrentSnapshot();
      callbacks.onMetric(finalMetric);

      // Cleanup
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }

      const summary = aggregator.getSummary();
      logger.info('k6 summary', {
        runId,
        totalRequests: summary.totalRequests,
        avgMs: summary.avgResponseTimeMs,
        p95Ms: summary.p95ResponseTimeMs,
        rps: summary.requestsPerSecond,
        failed: summary.failedRequests,
      });

      if (code === 0 || code === 99) {
        callbacks.onComplete(summary);
        resolve(summary);
      } else {
        const errorMsg = `k6 exited with code ${code}: ${stderrFull.slice(0, 500)}`;
        callbacks.onError(errorMsg);
        callbacks.onComplete(summary);
        resolve(summary);
      }
    });

    proc.on('error', (err) => {
      clearInterval(logInterval);
      activeProcesses.delete(runId);
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
      const errorMsg = `Failed to spawn k6: ${err.message}`;
      logger.error(errorMsg, { runId });
      callbacks.onError(errorMsg);
      reject(new Error(errorMsg));
    });
  });
}

export function stopK6Test(runId: string): boolean {
  const proc = activeProcesses.get(runId);
  if (!proc) {
    logger.warn('No active k6 process for stop', { runId });
    return false;
  }
  logger.info('Stopping k6', { runId, pid: proc.pid });
  proc.kill('SIGTERM');
  return true;
}

export function isK6TestRunning(runId: string): boolean {
  return activeProcesses.has(runId);
}

export function stopAllK6Tests(): void {
  for (const [runId, proc] of activeProcesses) {
    logger.info('Stopping k6 (shutdown)', { runId });
    proc.kill('SIGTERM');
  }
  activeProcesses.clear();
}
