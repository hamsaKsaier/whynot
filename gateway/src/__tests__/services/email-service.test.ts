import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery, mockEnv } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: {
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM_ADDRESS: 'WhyNot <notifications@whynot.qa>',
    FRONTEND_URL: 'http://localhost:5173',
  } as Record<string, string>,
}));

vi.mock('../../../shared/database/connection', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock env so RESEND_API_KEY is controllable
vi.mock('../../config/env', () => ({
  env: mockEnv,
}));

// Mock i18n — getFixedT returns a function that echoes back the key
const mockT = vi.fn((key: string) => key);
vi.mock('../../i18n', () => ({
  default: {
    getFixedT: () => mockT,
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  sendScanCompleteEmail,
  sendCriticalBugEmail,
  sendMonitorAlertEmail,
  sendAutoFixPREmail,
  sendPasswordResetEmail,
} from '../../services/email-service';

describe('email-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RESEND_API_KEY = 'test-resend-key';
  });

  describe('sendScanCompleteEmail', () => {
    it('skips if notification is disabled', async () => {
      mockQuery.mockResolvedValueOnce([{ enabled: false }]);
      await sendScanCompleteEmail('u-1', {
        projectName: 'Test',
        bugCount: 5,
        criticalCount: 1,
        scanUrl: 'https://app.test/scan/1',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skips if user has no email', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: null }]);
      await sendScanCompleteEmail('u-1', {
        projectName: 'Test',
        bugCount: 0,
        criticalCount: 0,
        scanUrl: 'https://app.test/scan/1',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends email via Resend when everything is valid', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: 'user@test.com' }]) // getUserEmail
        .mockResolvedValueOnce([{ preferred_language: 'en' }]); // getUserLocale
      mockFetch.mockResolvedValue({ ok: true });

      await sendScanCompleteEmail('u-1', {
        projectName: 'My App',
        bugCount: 3,
        criticalCount: 1,
        scanUrl: 'https://app.test/scan/1',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockEnv.RESEND_API_KEY}`,
          }),
        }),
      );
    });

    it('skips when RESEND_API_KEY is not set', async () => {
      mockEnv.RESEND_API_KEY = '';
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: 'user@test.com' }]) // getUserEmail
        .mockResolvedValueOnce([{ preferred_language: 'en' }]); // getUserLocale

      await sendScanCompleteEmail('u-1', {
        projectName: 'Test',
        bugCount: 0,
        criticalCount: 0,
        scanUrl: 'https://test.com',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendCriticalBugEmail', () => {
    it('sends email for critical bug', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: 'user@test.com' }]) // getUserEmail
        .mockResolvedValueOnce([{ preferred_language: 'en' }]); // getUserLocale
      mockFetch.mockResolvedValue({ ok: true });

      await sendCriticalBugEmail('u-1', {
        projectName: 'App',
        bugTitle: 'Login broken',
        severity: 'critical',
        bugUrl: 'https://app.test/bugs/1',
      });

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toBe('notification.criticalBug.subject');
    });
  });

  describe('sendMonitorAlertEmail', () => {
    it('sends monitor alert email', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: 'user@test.com' }]) // getUserEmail
        .mockResolvedValueOnce([{ preferred_language: 'en' }]); // getUserLocale
      mockFetch.mockResolvedValue({ ok: true });

      await sendMonitorAlertEmail('u-1', {
        monitorName: 'Health Check',
        url: 'https://example.com',
        alertType: 'downtime',
        dashboardUrl: 'https://app.test/monitors',
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendAutoFixPREmail', () => {
    it('sends auto-fix PR email', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // notification enabled (default)
        .mockResolvedValueOnce([{ email: 'user@test.com' }]) // getUserEmail
        .mockResolvedValueOnce([{ preferred_language: 'en' }]); // getUserLocale
      mockFetch.mockResolvedValue({ ok: true });

      await sendAutoFixPREmail('u-1', {
        projectName: 'App',
        prUrl: 'https://github.com/org/repo/pull/1',
        bugTitle: 'Button not working',
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email directly (no preference check)', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await sendPasswordResetEmail('user@test.com', 'reset-token-123');

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.subject).toBe('notification.passwordReset.heading');
      expect(body.html).toContain('reset-token-123');
    });
  });
});
