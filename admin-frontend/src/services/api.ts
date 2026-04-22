import axios from 'axios';
import { config } from '@/config';

const API_BASE_URL = config.apiUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_auth_token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────

export const login = async (email: string, password: string) => {
  const res = await apiClient.post('/auth/login', { email, password });
  return res.data;
};

export const getMe = async () => {
  const res = await apiClient.get('/auth/me');
  return res.data;
};

// ─── Admin: Plans ──────────────────────────────────────────────────────────

export const getAdminPlans = async () => {
  const res = await apiClient.get('/admin/plans');
  return res.data;
};

export const getAdminPlan = async (id: string) => {
  const res = await apiClient.get(`/admin/plans/${id}`);
  return res.data;
};

export const createPlan = async (data: any) => {
  const res = await apiClient.post('/admin/plans', data);
  return res.data;
};

export const updatePlan = async (id: string, data: any) => {
  const res = await apiClient.put(`/admin/plans/${id}`, data);
  return res.data;
};

export const archivePlan = async (id: string) => {
  const res = await apiClient.post(`/admin/plans/${id}/archive`);
  return res.data;
};

export const restorePlan = async (id: string) => {
  const res = await apiClient.post(`/admin/plans/${id}/restore`);
  return res.data;
};

export const setPlanFeatures = async (id: string, features: Record<string, string>) => {
  const res = await apiClient.post(`/admin/plans/${id}/features`, { features });
  return res.data;
};

export const removePlanFeature = async (planId: string, key: string) => {
  const res = await apiClient.delete(`/admin/plans/${planId}/features/${key}`);
  return res.data;
};

export const syncPlanToStripe = async (id: string) => {
  const res = await apiClient.post(`/admin/plans/${id}/sync-stripe`);
  return res.data;
};

// ─── Admin: Users ──────────────────────────────────────────────────────────

export const getAdminUsers = async (params?: { offset?: number; limit?: number; search?: string; role?: string }) => {
  const res = await apiClient.get('/admin/users', { params });
  return res.data;
};

export const getAdminUser = async (id: string) => {
  const res = await apiClient.get(`/admin/users/${id}`);
  return res.data;
};

export const updateUserRole = async (id: string, role: string) => {
  const res = await apiClient.put(`/admin/users/${id}/role`, { role });
  return res.data;
};

// ─── Admin: Credits ────────────────────────────────────────────────────────

export const getWorkspaceCredits = async (wsId: string) => {
  const res = await apiClient.get(`/admin/workspaces/${wsId}/credits`);
  return res.data;
};

export const grantCredits = async (wsId: string, amount: number, description: string) => {
  const res = await apiClient.post(`/admin/workspaces/${wsId}/credits/grant`, { amount, description });
  return res.data;
};

export const revokeCredits = async (wsId: string, amount: number, description: string) => {
  const res = await apiClient.post(`/admin/workspaces/${wsId}/credits/revoke`, { amount, description });
  return res.data;
};

export const getWorkspaceCreditHistory = async (wsId: string, offset = 0, limit = 50) => {
  const res = await apiClient.get(`/admin/workspaces/${wsId}/credits/history`, { params: { offset, limit } });
  return res.data;
};

// ─── Admin: Subscriptions ──────────────────────────────────────────────────

export const getAdminSubscriptions = async (params?: { offset?: number; limit?: number; status?: string; plan_id?: string }) => {
  const res = await apiClient.get('/admin/subscriptions', { params });
  return res.data;
};

export const getWorkspaceSubscription = async (wsId: string) => {
  const res = await apiClient.get(`/admin/workspaces/${wsId}/subscription`);
  return res.data;
};

export const updateWorkspaceSubscription = async (wsId: string, data: { plan_id?: string; status?: string }) => {
  const res = await apiClient.put(`/admin/workspaces/${wsId}/subscription`, data);
  return res.data;
};

// ─── Admin: Stats ──────────────────────────────────────────────────────────

export const getAdminOverviewStats = async () => {
  const res = await apiClient.get('/admin/stats/overview');
  return res.data;
};

// ─── Phase 6: Analytics ─────────────────────────────────────────────────────

export const getAnalyticsOverview = async () => {
  const res = await apiClient.get('/admin/analytics/overview');
  return res.data;
};

export const getAnalyticsSignups = async (days = 30) => {
  const res = await apiClient.get('/admin/analytics/signups', { params: { days } });
  return res.data;
};

export const getAnalyticsRevenue = async () => {
  const res = await apiClient.get('/admin/analytics/revenue');
  return res.data;
};

export const getAnalyticsUsage = async (days = 30) => {
  const res = await apiClient.get('/admin/analytics/usage', { params: { days } });
  return res.data;
};

export const getAnalyticsChurn = async (days = 90) => {
  const res = await apiClient.get('/admin/analytics/churn', { params: { days } });
  return res.data;
};

// ─── Phase 6: User Management (extended) ────────────────────────────────────

export const suspendUser = async (id: string) => {
  const res = await apiClient.post(`/admin/users/${id}/suspend`);
  return res.data;
};

export const unsuspendUser = async (id: string) => {
  const res = await apiClient.post(`/admin/users/${id}/unsuspend`);
  return res.data;
};

export const impersonateUser = async (id: string) => {
  const res = await apiClient.post(`/admin/users/${id}/impersonate`);
  return res.data;
};

export const resetUserPassword = async (id: string) => {
  const res = await apiClient.post(`/admin/users/${id}/reset-password`);
  return res.data;
};

export const moveUserOrganization = async (id: string, workspaceId: string) => {
  const res = await apiClient.patch(`/admin/users/${id}/organization`, { workspaceId });
  return res.data;
};

export const forceUserPlan = async (id: string, planId: string) => {
  const res = await apiClient.patch(`/admin/users/${id}/plan`, { planId });
  return res.data;
};

// ─── Admin: Organizations ─────────────────────────────────────────────────

export const getAdminOrganizations = async (params?: { offset?: number; limit?: number; search?: string }) => {
  const res = await apiClient.get('/admin/organizations', { params });
  return res.data;
};

export const getAdminOrganization = async (id: string) => {
  const res = await apiClient.get(`/admin/organizations/${id}`);
  return res.data;
};

export const updateOrganization = async (id: string, data: { name?: string; status?: string; planId?: string }) => {
  const res = await apiClient.patch(`/admin/organizations/${id}`, data);
  return res.data;
};

export const setOrgFlagOverrideViaOrg = async (orgId: string, key: string, enabled: boolean) => {
  const res = await apiClient.post(`/admin/organizations/${orgId}/flags/${key}`, { enabled });
  return res.data;
};

// ─── Phase 6: System Settings ───────────────────────────────────────────────

export const getSystemSettings = async () => {
  const res = await apiClient.get('/admin/settings');
  return res.data;
};

export const updateSystemSetting = async (key: string, value: string) => {
  const res = await apiClient.put(`/admin/settings/${key}`, { value });
  return res.data;
};

// ─── Phase 6: Announcements ────────────────────────────────────────────────

export const getAnnouncements = async () => {
  const res = await apiClient.get('/admin/announcements');
  return res.data;
};

export const createAnnouncement = async (data: { title: string; body?: string; type?: string; is_active?: boolean; starts_at?: string; ends_at?: string }) => {
  const res = await apiClient.post('/admin/announcements', data);
  return res.data;
};

export const updateAnnouncement = async (id: string, data: any) => {
  const res = await apiClient.put(`/admin/announcements/${id}`, data);
  return res.data;
};

export const deleteAnnouncement = async (id: string) => {
  const res = await apiClient.delete(`/admin/announcements/${id}`);
  return res.data;
};

// ─── Phase 6: Audit Log ────────────────────────────────────────────────────

export const getAuditLog = async (params?: { cursor?: string; limit?: number; actor_id?: string; action?: string; target_type?: string; target_id?: string; from?: string; to?: string }) => {
  const res = await apiClient.get('/admin/audit-log', { params });
  return res.data;
};

// ─── Admin: Usage Tracking ────────────────────────────────────────────────

export const getUsageEvents = async (params?: { cursor?: string; limit?: number; org_id?: string; from?: string; to?: string }) => {
  const res = await apiClient.get('/admin/usage', { params });
  return res.data;
};

export const getUsageSummary = async () => {
  const res = await apiClient.get('/admin/usage/summary');
  return res.data;
};

// ─── Phase 5: Feature Flags ───────────────────────────────────────────────

export const getFeatureFlags = async () => {
  const res = await apiClient.get('/admin/feature-flags');
  return res.data;
};

export const getOrgFeatureFlags = async (orgId: string) => {
  const res = await apiClient.get(`/admin/feature-flags/${orgId}`);
  return res.data;
};

export const setOrgFlagOverride = async (orgId: string, key: string, enabled: boolean) => {
  const res = await apiClient.put(`/admin/feature-flags/${orgId}/${key}`, { enabled });
  return res.data;
};

export const clearOrgFlagOverride = async (orgId: string, key: string) => {
  const res = await apiClient.delete(`/admin/feature-flags/${orgId}/${key}`);
  return res.data;
};

// ─── Admin: Billing Config ─────────────────────────────────────────────────

export const getBillingConfig = async () => {
  const res = await apiClient.get('/admin/billing-config');
  return res.data;
};

export const updateBillingConfig = async (updates: Record<string, string>) => {
  const res = await apiClient.patch('/admin/billing-config', updates);
  return res.data;
};

// ─── Admin: AI Providers ──────────────────────────────────────────────────

export interface AIProviderEntry {
  provider: string;
  displayName: string;
  enabled: boolean;
  rateLimit: number;
  hasKey: boolean;
  hasFallbackKey: boolean;
  maskedKey: string | null;
  maskedFallbackKey: string | null;
  defaultModel: string;
  models: string[];
}

export interface AIProvidersConfig {
  providers: AIProviderEntry[];
  defaultProvider: { provider: string; model: string };
  fallbackOrder: string[];
}

export const getAIProviders = async (): Promise<AIProvidersConfig> => {
  const res = await apiClient.get('/admin/ai-providers');
  return res.data;
};

export const updateAIProviders = async (providers: Partial<AIProviderEntry>[]): Promise<AIProvidersConfig> => {
  const res = await apiClient.patch('/admin/ai-providers', { providers });
  return res.data;
};

export const setProviderKey = async (provider: string, apiKey: string): Promise<{ hasKey: boolean; maskedKey: string }> => {
  const res = await apiClient.post(`/admin/ai-providers/${provider}/key`, { apiKey });
  return res.data;
};

export const removeProviderKey = async (provider: string): Promise<void> => {
  await apiClient.delete(`/admin/ai-providers/${provider}/key`);
};

export const setProviderFallbackKey = async (provider: string, apiKey: string): Promise<{ hasFallbackKey: boolean; maskedFallbackKey: string }> => {
  const res = await apiClient.post(`/admin/ai-providers/${provider}/fallback-key`, { apiKey });
  return res.data;
};

export const removeProviderFallbackKey = async (provider: string): Promise<void> => {
  await apiClient.delete(`/admin/ai-providers/${provider}/fallback-key`);
};

export const testProviderKey = async (provider: string, useFallback?: boolean): Promise<{ ok: boolean; latencyMs?: number; error?: string }> => {
  const params = useFallback ? '?useFallback=true' : '';
  const res = await apiClient.post(`/admin/ai-providers/${provider}/test${params}`);
  return res.data;
};

export const setDefaultModel = async (provider: string, model: string): Promise<void> => {
  await apiClient.patch('/admin/ai-providers/default-model', { provider, model });
};

export const setFallbackOrder = async (order: string[]): Promise<void> => {
  await apiClient.patch('/admin/ai-providers/fallback-order', { order });
};

export default apiClient;
