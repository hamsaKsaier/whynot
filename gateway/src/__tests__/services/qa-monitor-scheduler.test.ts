import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFindById, mockFindDueMonitors, mockUpdate } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindDueMonitors: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/qa-monitor-repository', () => ({
  QAMonitorRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findDueMonitors: mockFindDueMonitors,
    update: mockUpdate,
  })),
}));

vi.mock('../../services/email-service', () => ({
  sendMonitorAlertEmail: vi.fn().mockResolvedValue(undefined),
  sendScanCompleteEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { session: { id: 'session-1' } } }),
    get: vi.fn().mockResolvedValue({ data: { session: { status: 'completed', quality_score: 95 } } }),
  },
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  startMonitorScheduler,
  stopMonitorScheduler,
  triggerMonitorManually,
} from '../../services/qa-monitor-scheduler';

describe('qa-monitor-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopMonitorScheduler();
    vi.useRealTimers();
  });

  describe('startMonitorScheduler / stopMonitorScheduler', () => {
    it('starts and stops without error', () => {
      expect(() => startMonitorScheduler()).not.toThrow();
      expect(() => stopMonitorScheduler()).not.toThrow();
    });

    it('does not start duplicate scheduler', () => {
      startMonitorScheduler();
      startMonitorScheduler(); // should log warning but not crash
      stopMonitorScheduler();
    });
  });

  describe('triggerMonitorManually', () => {
    it('throws if monitor not found', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(triggerMonitorManually('non-existent')).rejects.toThrow('Monitor not found');
    });

    it('throws if monitor is disabled', async () => {
      mockFindById.mockResolvedValue({ id: 'm-1', is_enabled: false });
      await expect(triggerMonitorManually('m-1')).rejects.toThrow('Monitor is disabled');
    });

    it('triggers enabled monitor and returns session id', async () => {
      mockFindById
        .mockResolvedValueOnce({
          id: 'm-1',
          is_enabled: true,
          name: 'Test Monitor',
          target_url: 'https://example.com',
          quality_threshold: 80,
          max_iterations: 5,
          workspace_id: 'ws-1',
          cron_expression: '0 9 * * *',
          consecutive_failures: 0,
        })
        .mockResolvedValueOnce({ id: 'm-1', last_session_id: 'session-1' });

      mockUpdate.mockResolvedValue({});

      const result = await triggerMonitorManually('m-1');
      expect(result.sessionId).toBe('session-1');
    });
  });
});
