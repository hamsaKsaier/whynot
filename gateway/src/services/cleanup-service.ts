import fs from 'fs';
import path from 'path';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';

const logger = createLogger('cleanup-service');

const SCREENSHOTS_DIR = env.SCREENSHOTS_DIR || path.join(__dirname, '../../screenshots');
const VISUAL_DIFFS_DIR = env.VISUAL_DIFFS_DIR || path.join(__dirname, '../../visual-diffs');
const RETENTION_DAYS = env.SCREENSHOT_RETENTION_DAYS;

/**
 * Delete files in a directory that are older than `retentionDays` days.
 * Returns the count of deleted files.
 */
function purgeOldFiles(dir: string, retentionDays: number): number {
  if (!fs.existsSync(dir)) return 0;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch {
        // File may have been removed by another process; skip silently
      }
    }
  } catch (err: any) {
    logger.error('Error reading directory for cleanup', { dir, error: err.message });
  }

  return deleted;
}

/**
 * Run a full cleanup cycle and return how many files were deleted.
 */
export function runCleanup(): { screenshots: number; visualDiffs: number } {
  logger.info('Running screenshot cleanup', { retentionDays: RETENTION_DAYS });

  const screenshots = purgeOldFiles(SCREENSHOTS_DIR, RETENTION_DAYS);
  const visualDiffs = purgeOldFiles(VISUAL_DIFFS_DIR, RETENTION_DAYS);

  logger.info('Cleanup complete', { deletedScreenshots: screenshots, deletedVisualDiffs: visualDiffs });
  return { screenshots, visualDiffs };
}

/** Schedule a cleanup to run once on startup and then every 24 hours. */
export function startCleanupScheduler(): void {
  // Run once on startup
  runCleanup();

  // Then run every 24 hours
  setInterval(() => {
    runCleanup();
  }, 24 * 60 * 60 * 1000);

  logger.info('Cleanup scheduler started', { intervalHours: 24, retentionDays: RETENTION_DAYS });
}
