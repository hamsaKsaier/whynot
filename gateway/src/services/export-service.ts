import { createWriteStream, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import archiver from 'archiver';
import { query } from '../../shared/database/connection';
import { UsageEventRepository } from '../../shared/database/repositories/usage-event-repository';
import { AuditRepository } from '../../shared/database/repositories/audit-repository';
import { createLogger } from '../../shared/logger/logger';
import crypto from 'crypto';

const logger = createLogger('export-service');
const usageRepo = new UsageEventRepository();
const auditRepo = new AuditRepository();

const EXPORT_DIR = join(tmpdir(), 'whynot-exports');
const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

interface SignedToken {
  exportId: string;
  expiresAt: number;
}

const activeTokens = new Map<string, SignedToken>();

export class ExportService {
  static async processExport(exportId: string, userId: string, workspaceId: string): Promise<void> {
    try {
      await query(
        `UPDATE data_export_requests SET status = 'processing' WHERE id = $1`,
        [exportId],
      );

      if (!existsSync(EXPORT_DIR)) {
        mkdirSync(EXPORT_DIR, { recursive: true });
      }

      const zipPath = join(EXPORT_DIR, `${exportId}.zip`);
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      archive.pipe(output);

      const profile = await query<Record<string, unknown>>(
        `SELECT id, email, name, preferred_language, created_at, updated_at FROM users WHERE id = $1`,
        [userId],
      );
      archive.append(JSON.stringify(profile[0] ?? {}, null, 2), { name: 'profile.json' });
      archive.append(toCsv(profile, ['id', 'email', 'name', 'preferred_language', 'created_at', 'updated_at']), { name: 'profile.csv' });

      const aiConfigs = await query<Record<string, unknown>>(
        `SELECT id, provider, model, is_default, created_at FROM user_ai_configs WHERE user_id = $1`,
        [userId],
      );
      const redactedConfigs = aiConfigs.map((c) => ({ ...c, api_key: '***REDACTED***' }));
      archive.append(JSON.stringify(redactedConfigs, null, 2), { name: 'ai-configs.json' });
      archive.append(toCsv(redactedConfigs, ['id', 'provider', 'model', 'is_default', 'created_at']), { name: 'ai-configs.csv' });

      const notifPrefs = await query<Record<string, unknown>>(
        `SELECT trigger_type, channel, enabled FROM notification_preferences WHERE user_id = $1`,
        [userId],
      );
      const apiKeys = await query<Record<string, unknown>>(
        `SELECT id, label, last_four, created_at, last_used_at, revoked_at FROM user_api_keys WHERE user_id = $1`,
        [userId],
      );
      const settingsPayload = {
        preferredLanguage: profile[0]?.preferred_language ?? 'en',
        notificationPreferences: notifPrefs,
        apiKeys: apiKeys.map((k) => ({ ...k, key_hash: '***REDACTED***', key_salt: '***REDACTED***' })),
      };
      archive.append(JSON.stringify(settingsPayload, null, 2), { name: 'settings.json' });

      const executions = await query<Record<string, unknown>>(
        `SELECT id, project_id, status, started_at, completed_at, created_at
         FROM test_executions WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
      );
      archive.append(JSON.stringify(executions, null, 2), { name: 'test-runs.json' });
      archive.append(toCsv(executions, ['id', 'project_id', 'status', 'started_at', 'completed_at', 'created_at']), { name: 'test-runs.csv' });

      const results = await query<Record<string, unknown>>(
        `SELECT id, execution_id, test_case_id, status, error_message, duration_ms, created_at
         FROM test_results WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10000`,
        [workspaceId],
      );
      archive.append(JSON.stringify(results, null, 2), { name: 'results.json' });
      archive.append(toCsv(results, ['id', 'execution_id', 'test_case_id', 'status', 'error_message', 'duration_ms', 'created_at']), { name: 'results.csv' });

      const billingHistory = await query<Record<string, unknown>>(
        `SELECT id, amount_cents, currency, status, period_start, period_end, created_at
         FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
      );
      archive.append(JSON.stringify(billingHistory, null, 2), { name: 'billing-history.json' });
      archive.append(toCsv(billingHistory, ['id', 'amount_cents', 'currency', 'status', 'period_start', 'period_end', 'created_at']), { name: 'billing-history.csv' });

      const allUsageEvents: Record<string, unknown>[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const page = await usageRepo.listByOrg(workspaceId, { cursor, limit: 100 });
        for (const e of page.entries) {
          allUsageEvents.push({
            id: e.id,
            event_type: e.event_type,
            quantity: e.quantity,
            credits_consumed: e.credits_consumed.toString(),
            metadata: e.metadata,
            created_at: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
          });
        }
        cursor = page.nextCursor ?? undefined;
        hasMore = !!page.nextCursor;
      }
      archive.append(JSON.stringify(allUsageEvents, null, 2), { name: 'usage-events.json' });
      archive.append(toCsv(allUsageEvents, ['id', 'event_type', 'quantity', 'credits_consumed', 'created_at']), { name: 'usage-events.csv' });

      const auditLogs = await query<Record<string, unknown>>(
        `SELECT id, action, target_type, target_id, details, ip_address, created_at
         FROM audit_log WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 10000`,
        [userId],
      );
      archive.append(JSON.stringify(auditLogs, null, 2), { name: 'audit-log.json' });
      archive.append(toCsv(auditLogs, ['id', 'action', 'target_type', 'target_id', 'ip_address', 'created_at']), { name: 'audit-log.csv' });

      await archive.finalize();
      await new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });

      const token = crypto.randomBytes(32).toString('hex');
      activeTokens.set(token, {
        exportId,
        expiresAt: Date.now() + SIGNED_URL_TTL_MS,
      });

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      const downloadUrl = `${baseUrl}/api/me/account/export/${exportId}/download?token=${token}`;

      await query(
        `UPDATE data_export_requests SET status = 'completed', download_url = $1, completed_at = NOW() WHERE id = $2`,
        [downloadUrl, exportId],
      );

      logger.info('Export completed', { exportId, userId });
    } catch (err) {
      logger.error('Export failed', { exportId, error: (err as Error).message });
      await query(
        `UPDATE data_export_requests SET status = 'failed' WHERE id = $1`,
        [exportId],
      );
    }
  }

  static validateToken(token: string, exportId: string): boolean {
    const entry = activeTokens.get(token);
    if (!entry) return false;
    if (entry.exportId !== exportId) return false;
    if (Date.now() > entry.expiresAt) {
      activeTokens.delete(token);
      return false;
    }
    return true;
  }

  static getExportFilePath(exportId: string): string {
    return join(EXPORT_DIR, `${exportId}.zip`);
  }

  static cleanup(exportId: string, token: string): void {
    activeTokens.delete(token);
    const filePath = join(EXPORT_DIR, `${exportId}.zip`);
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // best-effort cleanup
    }
  }
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  if (rows.length === 0) return columns.join(',') + '\n';
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}
