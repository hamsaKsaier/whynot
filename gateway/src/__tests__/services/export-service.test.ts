import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../shared/database/repositories/usage-event-repository', () => ({
  UsageEventRepository: vi.fn().mockImplementation(() => ({
    listByOrg: vi.fn().mockResolvedValue({ entries: [], nextCursor: null }),
  })),
}));

vi.mock('../../../shared/database/repositories/audit-repository', () => ({
  AuditRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('archiver', () => ({
  default: vi.fn().mockReturnValue({
    pipe: vi.fn(),
    append: vi.fn(),
    finalize: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { ExportService } from '../../services/export-service';

describe('ExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateToken', () => {
    it('returns false for non-existent token', () => {
      expect(ExportService.validateToken('non-existent', 'export-1')).toBe(false);
    });
  });

  describe('getExportFilePath', () => {
    it('returns path in temp directory', () => {
      const filePath = ExportService.getExportFilePath('export-123');
      expect(filePath).toContain('export-123.zip');
      expect(filePath).toContain('whynot-exports');
    });
  });

  describe('cleanup', () => {
    it('does not throw for non-existent files', () => {
      expect(() => ExportService.cleanup('non-existent', 'token')).not.toThrow();
    });
  });
});
