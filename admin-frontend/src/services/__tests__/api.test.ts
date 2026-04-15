import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors,
  };
  return {
    default: {
      create: vi.fn(() => instance),
    },
  };
});

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('creates axios instance with correct baseURL and timeout', async () => {
    await import('../api');
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: '/api',
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('registers request and response interceptors', async () => {
    await import('../api');
    const instance = vi.mocked(axios.create).mock.results[0]?.value;
    expect(instance.interceptors.request.use).toHaveBeenCalled();
    expect(instance.interceptors.response.use).toHaveBeenCalled();
  });

  it('exports login function', async () => {
    const api = await import('../api');
    expect(typeof api.login).toBe('function');
  });

  it('exports getMe function', async () => {
    const api = await import('../api');
    expect(typeof api.getMe).toBe('function');
  });

  it('exports plan management functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAdminPlans).toBe('function');
    expect(typeof api.getAdminPlan).toBe('function');
    expect(typeof api.createPlan).toBe('function');
    expect(typeof api.updatePlan).toBe('function');
    expect(typeof api.archivePlan).toBe('function');
    expect(typeof api.restorePlan).toBe('function');
    expect(typeof api.setPlanFeatures).toBe('function');
    expect(typeof api.removePlanFeature).toBe('function');
    expect(typeof api.syncPlanToStripe).toBe('function');
  });

  it('exports user management functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAdminUsers).toBe('function');
    expect(typeof api.getAdminUser).toBe('function');
    expect(typeof api.updateUserRole).toBe('function');
    expect(typeof api.suspendUser).toBe('function');
    expect(typeof api.unsuspendUser).toBe('function');
    expect(typeof api.impersonateUser).toBe('function');
    expect(typeof api.resetUserPassword).toBe('function');
    expect(typeof api.moveUserOrganization).toBe('function');
    expect(typeof api.forceUserPlan).toBe('function');
  });

  it('exports credit functions', async () => {
    const api = await import('../api');
    expect(typeof api.getWorkspaceCredits).toBe('function');
    expect(typeof api.grantCredits).toBe('function');
    expect(typeof api.revokeCredits).toBe('function');
    expect(typeof api.getWorkspaceCreditHistory).toBe('function');
  });

  it('exports subscription functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAdminSubscriptions).toBe('function');
    expect(typeof api.getWorkspaceSubscription).toBe('function');
    expect(typeof api.updateWorkspaceSubscription).toBe('function');
  });

  it('exports analytics functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAnalyticsOverview).toBe('function');
    expect(typeof api.getAnalyticsSignups).toBe('function');
    expect(typeof api.getAnalyticsRevenue).toBe('function');
    expect(typeof api.getAnalyticsUsage).toBe('function');
    expect(typeof api.getAnalyticsChurn).toBe('function');
  });

  it('exports organization functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAdminOrganizations).toBe('function');
    expect(typeof api.getAdminOrganization).toBe('function');
    expect(typeof api.updateOrganization).toBe('function');
    expect(typeof api.setOrgFlagOverrideViaOrg).toBe('function');
  });

  it('exports feature flags functions', async () => {
    const api = await import('../api');
    expect(typeof api.getFeatureFlags).toBe('function');
    expect(typeof api.getOrgFeatureFlags).toBe('function');
    expect(typeof api.setOrgFlagOverride).toBe('function');
    expect(typeof api.clearOrgFlagOverride).toBe('function');
  });

  it('exports billing config functions', async () => {
    const api = await import('../api');
    expect(typeof api.getBillingConfig).toBe('function');
    expect(typeof api.updateBillingConfig).toBe('function');
  });

  it('exports AI provider functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAIProviders).toBe('function');
    expect(typeof api.updateAIProviders).toBe('function');
  });

  it('exports system settings functions', async () => {
    const api = await import('../api');
    expect(typeof api.getSystemSettings).toBe('function');
    expect(typeof api.updateSystemSetting).toBe('function');
  });

  it('exports announcements functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAnnouncements).toBe('function');
    expect(typeof api.createAnnouncement).toBe('function');
    expect(typeof api.updateAnnouncement).toBe('function');
    expect(typeof api.deleteAnnouncement).toBe('function');
  });

  it('exports audit log and usage functions', async () => {
    const api = await import('../api');
    expect(typeof api.getAuditLog).toBe('function');
    expect(typeof api.getUsageEvents).toBe('function');
    expect(typeof api.getUsageSummary).toBe('function');
  });

  it('exports stats function', async () => {
    const api = await import('../api');
    expect(typeof api.getAdminOverviewStats).toBe('function');
  });
});
