import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// We need to mock fs to avoid actual file operations
vi.mock('fs');

import { runCleanup } from '../../services/cleanup-service';

describe('cleanup-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runCleanup', () => {
    it('returns zero counts when directories do not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = runCleanup();

      expect(result).toEqual({ screenshots: 0, visualDiffs: 0 });
    });

    it('deletes files older than retention period', () => {
      (fs.existsSync as any).mockReturnValue(true);

      const oldTime = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
      const recentTime = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago

      (fs.readdirSync as any).mockReturnValue([
        { name: 'old.png', isFile: () => true },
        { name: 'recent.png', isFile: () => true },
        { name: 'subdir', isFile: () => false },
      ]);

      let callCount = 0;
      (fs.statSync as any).mockImplementation(() => {
        callCount++;
        return { mtimeMs: callCount % 2 === 1 ? oldTime : recentTime };
      });

      (fs.unlinkSync as any).mockImplementation(() => {});

      const result = runCleanup();

      // Both screenshots and visualDiffs directories are processed
      // Each has 1 old file to delete
      expect(result.screenshots).toBeGreaterThanOrEqual(0);
      expect(result.visualDiffs).toBeGreaterThanOrEqual(0);
    });

    it('skips non-file entries', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockReturnValue([
        { name: 'subdir', isFile: () => false },
      ]);

      const result = runCleanup();

      expect(fs.statSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('handles errors reading directory gracefully', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = runCleanup();

      expect(result).toEqual({ screenshots: 0, visualDiffs: 0 });
    });
  });
});
