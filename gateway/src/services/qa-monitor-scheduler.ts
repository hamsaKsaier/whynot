/**
 * QA Monitor Scheduler
 *
 * Runs every 60 seconds, finds monitors due to run, and triggers QA sessions.
 * Calculates the next run time based on cron expressions.
 */

import axios from 'axios';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';
import { QAMonitorRepository, QAMonitorEntity } from '../../shared/database/repositories/qa-monitor-repository';
import { sendMonitorAlertEmail, sendScanCompleteEmail } from './email-service';
import { query as dbQuery } from '../../shared/database/connection';

const logger = createLogger('qa-monitor-scheduler');

const qaLoopExecutorUrl = env.QA_LOOP_EXECUTOR_URL;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

const monitorRepository = new QAMonitorRepository();

/**
 * Start the scheduler (runs every 60 seconds)
 */
export function startMonitorScheduler(): void {
  if (schedulerInterval) {
    logger.warn('Monitor scheduler already running');
    return;
  }

  logger.info('QA Monitor Scheduler started (checking every 60s)');

  // Initial check after 30s delay (allow services to start up)
  setTimeout(() => {
    checkDueMonitors().catch(err => logger.error('Monitor check failed', { error: err.message }));
  }, 30_000);

  schedulerInterval = setInterval(() => {
    checkDueMonitors().catch(err => logger.error('Monitor check failed', { error: err.message }));
  }, 60_000);
}

/**
 * Stop the scheduler
 */
export function stopMonitorScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('QA Monitor Scheduler stopped');
  }
}

/**
 * Check for due monitors and trigger them
 */
async function checkDueMonitors(): Promise<void> {
  try {
    const dueMonitors = await monitorRepository.findDueMonitors();

    if (dueMonitors.length === 0) return;

    logger.info(`Found ${dueMonitors.length} due monitor(s)`, {
      monitors: dueMonitors.map(m => ({ id: m.id, name: m.name })),
    });

    for (const monitor of dueMonitors) {
      try {
        await triggerMonitor(monitor);
      } catch (error: any) {
        logger.error('Failed to trigger monitor', {
          monitorId: monitor.id,
          name: monitor.name,
          error: error.message,
        });

        await monitorRepository.update(monitor.id, {
          last_status: 'error',
          consecutive_failures: monitor.consecutive_failures + 1,
          next_run_at: calculateNextRun(monitor.cron_expression),
        });
      }
    }
  } catch (error: any) {
    logger.error('Failed to check due monitors', { error: error.message });
  }
}

/**
 * Trigger a single monitor — start a QA Loop session
 */
async function triggerMonitor(monitor: QAMonitorEntity): Promise<void> {
  logger.info('Triggering monitor', {
    monitorId: monitor.id,
    name: monitor.name,
    targetUrl: monitor.target_url,
  });

  // Mark as running
  await monitorRepository.update(monitor.id, {
    last_status: 'running',
    last_run_at: new Date(),
  });

  try {
    // Start QA session via the QA Loop executor
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (monitor.workspace_id) {
      headers['X-Workspace-ID'] = monitor.workspace_id;
    }

    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions`,
      {
        targetUrl: monitor.target_url,
        qualityThreshold: monitor.quality_threshold,
        maxIterations: monitor.max_iterations,
        workspaceId: monitor.workspace_id,
        documentContext: monitor.document_context || undefined,
        loginCredentials: monitor.login_credentials || undefined,
      },
      { headers, timeout: 30_000 }
    );

    const sessionId = response.data?.session?.id;

    // Calculate next run time
    const nextRun = calculateNextRun(monitor.cron_expression);

    await monitorRepository.update(monitor.id, {
      last_session_id: sessionId || null,
      next_run_at: nextRun,
    });

    logger.info('Monitor session started', {
      monitorId: monitor.id,
      sessionId,
      nextRun: nextRun?.toISOString(),
    });

    // Poll for completion in background (don't block the scheduler)
    if (sessionId) {
      pollSessionCompletion(monitor.id, sessionId, monitor.quality_threshold)
        .catch(err => logger.error('Monitor poll failed', { monitorId: monitor.id, error: err.message }));
    }
  } catch (error: any) {
    throw new Error(`Failed to start QA session: ${error.message}`);
  }
}

/**
 * Poll a session until it completes, then update the monitor
 */
async function pollSessionCompletion(
  monitorId: string,
  sessionId: string,
  qualityThreshold: number
): Promise<void> {
  const maxPollTime = 15 * 60 * 1000; // 15 minutes
  const pollInterval = 30_000; // 30 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await sleep(pollInterval);

    try {
      const response = await axios.get(
        `${qaLoopExecutorUrl}/api/sessions/${sessionId}`,
        { timeout: 10_000 }
      );

      const session = response.data?.session || response.data;
      const status = session?.status;

      if (status === 'completed' || status === 'stopped' || status === 'failed') {
        const qualityScore = session.quality_score || 0;
        const isPass = qualityScore >= qualityThreshold;

        const monitor = await monitorRepository.findById(monitorId);
        const previousScore = monitor?.last_quality_score;

        await monitorRepository.update(monitorId, {
          last_quality_score: qualityScore,
          last_status: isPass ? 'pass' : 'fail',
          consecutive_failures: isPass ? 0 : (monitor?.consecutive_failures || 0) + 1,
        });

        logger.info('Monitor session completed', {
          monitorId,
          sessionId,
          qualityScore,
          status: isPass ? 'pass' : 'fail',
          previousScore,
        });

        // ── Regression detection ──────────────────────────────────────
        // Compare current bugs with previous run to detect new regressions
        let newBugCount = 0;
        const currentBugs = session.bugs_found || 0;
        try {
          if (monitor?.workspace_id) {
            const previousSessions = await dbQuery<{ bugs_found: number }>(
              `SELECT bugs_found FROM qa_loop_sessions
               WHERE workspace_id = $1 AND target_url = $2 AND id != $3
               ORDER BY created_at DESC LIMIT 1`,
              [monitor.workspace_id, monitor.target_url, sessionId],
            );
            if (previousSessions.length > 0) {
              const previousBugs = previousSessions[0].bugs_found || 0;
              newBugCount = Math.max(0, currentBugs - previousBugs);
              if (newBugCount > 0) {
                logger.info('Regression detected', {
                  monitorId, sessionId,
                  currentBugs, previousBugs, newBugCount,
                });
              }
            }
          }
        } catch (regrErr: any) {
          logger.warn('Failed to check for regressions', { error: regrErr.message });
        }

        // Send email notifications to workspace members
        try {
          const frontendUrl = env.FRONTEND_URL;
          if (monitor?.workspace_id) {
            // Find workspace members to notify
            const members = await dbQuery<{ user_id: string }>(
              'SELECT user_id FROM workspace_members WHERE workspace_id = $1',
              [monitor.workspace_id],
            );
            for (const member of members) {
              // Alert on failure
              if (!isPass) {
                sendMonitorAlertEmail(member.user_id, {
                  monitorName: monitor.name,
                  url: monitor.target_url,
                  alertType: status === 'failed' ? 'Session failed' : `Quality score ${qualityScore}% below threshold ${qualityThreshold}%`,
                  dashboardUrl: `${frontendUrl}/monitors`,
                }).catch(e => logger.warn('Monitor alert email failed', { error: e.message }));
              }

              // Alert on regressions (new bugs detected compared to previous run)
              if (newBugCount > 0 && monitor.notify_on_regression) {
                sendMonitorAlertEmail(member.user_id, {
                  monitorName: monitor.name,
                  url: monitor.target_url,
                  alertType: `${newBugCount} new bug${newBugCount !== 1 ? 's' : ''} detected (regression)`,
                  dashboardUrl: `${frontendUrl}/qa-loop?session=${sessionId}`,
                }).catch(e => logger.warn('Regression alert email failed', { error: e.message }));
              }

              sendScanCompleteEmail(member.user_id, {
                projectName: monitor.name,
                bugCount: currentBugs,
                criticalCount: 0,
                scanUrl: `${frontendUrl}/qa-loop?session=${sessionId}`,
              }).catch(e => logger.warn('Scan complete email failed', { error: e.message }));
            }
          }
        } catch (emailErr: any) {
          logger.warn('Failed to send monitor notification emails', { error: emailErr.message });
        }

        return;
      }
    } catch (error: any) {
      logger.warn('Failed to poll monitor session', {
        monitorId,
        sessionId,
        error: error.message,
      });
    }
  }

  // Timeout — mark as error
  await monitorRepository.update(monitorId, {
    last_status: 'error',
  });

  logger.warn('Monitor session timed out', { monitorId, sessionId });
}

/**
 * Calculate next run time from a cron expression
 *
 * Simplified cron parser supporting: minute hour dayOfMonth month dayOfWeek
 * For the common presets we support:
 *   "0 9 * * *"     = every day at 9am
 *   "0 9 * * 1-5"   = weekdays at 9am
 *   "0 9 * * 1"     = every Monday at 9am
 *   "0 0 1 * *"     = first of month at midnight
 */
function calculateNextRun(cron: string): Date {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Set the time
    const targetMinute = minute === '*' ? now.getMinutes() : parseInt(minute, 10);
    const targetHour = hour === '*' ? now.getHours() : parseInt(hour, 10);

    next.setMinutes(targetMinute);
    next.setSeconds(0);
    next.setMilliseconds(0);
    next.setHours(targetHour);

    // If the time has already passed today, move to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // Handle day-of-week constraints
    if (dayOfWeek !== '*') {
      const targetDays = parseCronField(dayOfWeek, 0, 6);
      let attempts = 0;
      while (!targetDays.includes(next.getDay()) && attempts < 7) {
        next.setDate(next.getDate() + 1);
        attempts++;
      }
    }

    // Handle day-of-month constraints
    if (dayOfMonth !== '*') {
      const targetDay = parseInt(dayOfMonth, 10);
      if (!isNaN(targetDay)) {
        next.setDate(targetDay);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
      }
    }

    return next;
  } catch {
    // Fallback: 24 hours from now
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 24);
    return fallback;
  }
}

/**
 * Parse a cron field into a list of values
 * Supports: *, n, n-m, n,m
 */
function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  const values: number[] = [];

  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
    } else {
      values.push(parseInt(part, 10));
    }
  }

  return values.filter(v => !isNaN(v) && v >= min && v <= max);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Manually trigger a monitor (for the API)
 */
export async function triggerMonitorManually(monitorId: string): Promise<{ sessionId?: string }> {
  const monitor = await monitorRepository.findById(monitorId);
  if (!monitor) throw new Error('Monitor not found');
  if (!monitor.is_enabled) throw new Error('Monitor is disabled');

  await triggerMonitor(monitor);

  const updated = await monitorRepository.findById(monitorId);
  return { sessionId: updated?.last_session_id || undefined };
}
