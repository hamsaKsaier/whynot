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

  const script = generateK6Script(config);
  fs.writeFileSync(scriptPath, script, 'utf-8');
  logger.info('Generated k6 script', { runId, scriptPath, scriptLength: script.length });
  logger.info('k6 script content', { runId, script });

  const aggregator = new K6MetricsAggregator();

  return new Promise((resolve, reject) => {
    const k6Args = ['run', '--out', `json=${jsonOutputPath}`, scriptPath];

    logger.info('Spawning k6 process', { runId, args: k6Args });

    // Only pass safe env vars to k6
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
    logger.info('k6 process spawned', { runId, pid: proc.pid });

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
        aggregator.parseStdoutLine(line);
      }
    });

    // Stream metrics from JSON output in real-time
    let jsonReadOffset = 0;
    let tickCount = 0;
    let totalLinesProcessed = 0;
    let totalMetricsEmitted = 0;

    const jsonStreamInterval = setInterval(() => {
      tickCount++;
      try {
        const fileExists = fs.existsSync(jsonOutputPath);
        if (!fileExists) {
          if (tickCount <= 3) {
            logger.info('k6 JSON file not yet created', { runId, tick: tickCount });
          }
          return;
        }

        const stat = fs.statSync(jsonOutputPath);
        if (stat.size <= jsonReadOffset) return; // No new data

        const content = fs.readFileSync(jsonOutputPath, 'utf-8');
        const newContent = content.slice(jsonReadOffset);
        jsonReadOffset = content.length;

        const lines = newContent.split('\n').filter(l => l.trim());
        totalLinesProcessed += lines.length;

        for (const line of lines) {
          const metric = aggregator.parseLine(line);
          if (metric) {
            totalMetricsEmitted++;
            logger.info('Emitting perf metric', {
              runId,
              requests: metric.requests,
              avgRT: metric.avgResponseTime,
              vus: metric.vus,
              rps: metric.requestsPerSecond,
            });
            callbacks.onMetric(metric);
          }
        }

        // Force emit a snapshot every tick even if parseLine didn't emit
        // (parseLine throttles to 1/sec, but we want guaranteed updates)
        if (lines.length > 0) {
          const snapshot = aggregator.getCurrentSnapshot();
          if (snapshot.requests > 0) {
            totalMetricsEmitted++;
            callbacks.onMetric(snapshot);
          }
        }

        if (tickCount % 5 === 0) {
          logger.info('k6 stream progress', {
            runId, tick: tickCount,
            fileSize: stat.size,
            linesProcessed: totalLinesProcessed,
            metricsEmitted: totalMetricsEmitted,
          });
        }
      } catch (err: any) {
        logger.warn('k6 JSON stream tick error', { runId, error: err.message });
      }
    }, 1000);

    proc.on('close', (code) => {
      clearInterval(jsonStreamInterval);
      activeProcesses.delete(runId);

      logger.info('k6 process exited', {
        runId, code,
        totalLinesProcessed,
        totalMetricsEmitted,
        stderrLength: stderrFull.length,
      });

      if (code !== 0 && code !== 99) {
        logger.error('k6 failed — stderr', { runId, code, stderr: stderrFull.slice(0, 2000) });
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
      logger.info('k6 final summary', {
        runId,
        totalRequests: summary.totalRequests,
        avgMs: summary.avgResponseTimeMs,
        p95Ms: summary.p95ResponseTimeMs,
        rps: summary.requestsPerSecond,
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
      clearInterval(jsonStreamInterval);
      activeProcesses.delete(runId);
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
      try { fs.unlinkSync(jsonOutputPath); } catch { /* ignore */ }
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
    logger.warn('No active k6 process found for stop', { runId });
    return false;
  }
  logger.info('Stopping k6 test', { runId, pid: proc.pid });
  proc.kill('SIGTERM');
  // Don't delete from activeProcesses here — let the 'close' handler do it
  return true;
}

export function isK6TestRunning(runId: string): boolean {
  return activeProcesses.has(runId);
}

export function stopAllK6Tests(): void {
  for (const [runId, proc] of activeProcesses) {
    logger.info('Stopping k6 test during shutdown', { runId });
    proc.kill('SIGTERM');
  }
  activeProcesses.clear();
}
