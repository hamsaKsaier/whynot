/**
 * email-service.ts
 *
 * Sends transactional email notifications via Resend.com.
 * All templates use clean, minimal HTML with WhyNot branding.
 */

import { createLogger } from '../../shared/logger/logger';
import { query } from '../../shared/database/connection';
import { env } from '../config/env';

const logger = createLogger('email-service');

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = env.EMAIL_FROM_ADDRESS;

// ── Template helper ──────────────────────────────────────────────────────────

function emailLayout(content: string, ctaUrl?: string, ctaText?: string): string {
  const ctaBlock = ctaUrl && ctaText
    ? `<div style="text-align:center;margin:24px 0">
         <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">${ctaText}</a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f1f5f9">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <!-- Header -->
    <div style="background-color:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px">WhyNot</span>
    </div>
    <!-- Body -->
    <div style="background-color:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
      ${content}
      ${ctaBlock}
    </div>
    <!-- Footer -->
    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px">
      You're receiving this because you have notifications enabled in WhyNot.
    </div>
  </div>
</body>
</html>`;
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — skipping email', { to, subject });
    return;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Resend API error', { status: response.status, body: errorBody, to, subject });
    } else {
      logger.info('Email sent', { to, subject });
    }
  } catch (err: any) {
    logger.error('Failed to send email', { error: err.message, to, subject });
  }
}

// ── Preference check ─────────────────────────────────────────────────────────

async function isNotificationEnabled(userId: string, triggerType: string): Promise<boolean> {
  try {
    const rows = await query<{ enabled: boolean }>(
      `SELECT enabled FROM notification_preferences
       WHERE user_id = $1 AND trigger_type = $2 AND channel = 'email'`,
      [userId, triggerType],
    );
    // Default to enabled if no row exists
    return rows.length === 0 ? true : rows[0].enabled;
  } catch {
    return true; // default to enabled if table doesn't exist yet
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const rows = await query<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [userId]);
    return rows[0]?.email || null;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ScanCompleteData {
  projectName: string;
  bugCount: number;
  criticalCount: number;
  scanUrl: string;
}

export async function sendScanCompleteEmail(userId: string, data: ScanCompleteData): Promise<void> {
  if (!(await isNotificationEnabled(userId, 'scan_complete'))) return;
  const to = await getUserEmail(userId);
  if (!to) return;

  const subject = `Scan complete: ${data.projectName}`;
  const html = emailLayout(
    `<h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">Scan Complete</h2>
     <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5">
       Your QA scan for <strong>${data.projectName}</strong> has finished.
     </p>
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5">
       Found <strong>${data.bugCount}</strong> bug${data.bugCount !== 1 ? 's' : ''}${data.criticalCount > 0 ? ` (<span style="color:#dc2626">${data.criticalCount} critical</span>)` : ''}.
     </p>`,
    data.scanUrl,
    'View Results',
  );
  await sendEmail(to, subject, html);
}

export interface CriticalBugData {
  projectName: string;
  bugTitle: string;
  severity: string;
  bugUrl: string;
}

export async function sendCriticalBugEmail(userId: string, data: CriticalBugData): Promise<void> {
  if (!(await isNotificationEnabled(userId, 'critical_bug'))) return;
  const to = await getUserEmail(userId);
  if (!to) return;

  const subject = `Critical bug found in ${data.projectName}`;
  const html = emailLayout(
    `<h2 style="margin:0 0 12px;font-size:18px;color:#dc2626">Critical Bug Found</h2>
     <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5">
       A <strong style="color:#dc2626">${data.severity}</strong> severity bug was found in <strong>${data.projectName}</strong>.
     </p>
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5">
       <strong>${data.bugTitle}</strong>
     </p>`,
    data.bugUrl,
    'View Bug',
  );
  await sendEmail(to, subject, html);
}

export interface MonitorAlertData {
  monitorName: string;
  url: string;
  alertType: string;
  dashboardUrl: string;
}

export async function sendMonitorAlertEmail(userId: string, data: MonitorAlertData): Promise<void> {
  if (!(await isNotificationEnabled(userId, 'monitor_alert'))) return;
  const to = await getUserEmail(userId);
  if (!to) return;

  const subject = `Monitor alert: ${data.monitorName}`;
  const html = emailLayout(
    `<h2 style="margin:0 0 12px;font-size:18px;color:#f59e0b">Monitor Alert</h2>
     <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5">
       Monitor <strong>${data.monitorName}</strong> triggered an alert: <strong>${data.alertType}</strong>.
     </p>
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5">
       URL: ${data.url}
     </p>`,
    data.dashboardUrl,
    'View Dashboard',
  );
  await sendEmail(to, subject, html);
}

export interface AutoFixPRData {
  projectName: string;
  prUrl: string;
  bugTitle: string;
}

export async function sendAutoFixPREmail(userId: string, data: AutoFixPRData): Promise<void> {
  if (!(await isNotificationEnabled(userId, 'autofix_pr'))) return;
  const to = await getUserEmail(userId);
  if (!to) return;

  const subject = `Auto-fix PR created for ${data.projectName}`;
  const html = emailLayout(
    `<h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">Auto-Fix PR Ready</h2>
     <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5">
       A pull request has been created to fix <strong>${data.bugTitle}</strong> in <strong>${data.projectName}</strong>.
     </p>`,
    data.prUrl,
    'Review PR',
  );
  await sendEmail(to, subject, html);
}

// ── Password Reset Email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const frontendUrl = env.FRONTEND_URL;
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const subject = 'Reset your WhyNot password';
  const html = emailLayout(
    `<h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">Password Reset</h2>
     <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.5">
       We received a request to reset your password. Click the button below to choose a new one.
     </p>
     <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">
       This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
     </p>`,
    resetUrl,
    'Reset Password',
  );
  await sendEmail(to, subject, html);
}
