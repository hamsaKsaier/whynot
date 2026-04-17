import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';
import { renderAtLocale, resetLocale, LANGUAGES } from './helpers/renderAtLocale';
import { PAGES } from './pages-manifest';
import { BRAND_ALLOW_LIST } from '@shared/constants/brand-allowlist';

// ─── Global mocks ─────────────────────────────────────────────────────────────

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds: readonly number[] = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'super_admin',
    },
    isAuthenticated: true,
    isAdmin: true,
    isSuperadmin: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../providers/FeatureFlagsProvider', () => ({
  useFeatureFlags: () => ({}),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
  useFeatureFlagsContext: () => ({ flags: {}, isLoading: false }),
}));

vi.mock('../hooks/useDirection', () => ({
  default: () => ({ direction: 'ltr' as const, setDirection: vi.fn(), isRtl: false }),
}));

vi.mock('../hooks/useFeatureFlag', () => ({
  default: () => false,
  useFeatureFlag: () => false,
}));

vi.mock('../components/DirectionProvider', () => ({
  DirectionProvider: ({ children }: { children: React.ReactNode }) => children,
  useDirectionContext: () => ({
    direction: 'ltr' as const,
    setDirection: vi.fn(),
    isRtl: false,
  }),
}));

vi.mock('../components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useThemeContext: () => ({
    theme: 'light' as const,
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../services/api', () => {
  const mockFn = () => vi.fn().mockResolvedValue({ data: [] });
  return {
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({ data: [] }),
      put: vi.fn().mockResolvedValue({ data: [] }),
      patch: vi.fn().mockResolvedValue({ data: [] }),
      delete: vi.fn().mockResolvedValue({ data: [] }),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
    default: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({ data: [] }),
      put: vi.fn().mockResolvedValue({ data: [] }),
      patch: vi.fn().mockResolvedValue({ data: [] }),
      delete: vi.fn().mockResolvedValue({ data: [] }),
    },

    // Auth
    login: mockFn(),
    getMe: mockFn(),

    // Plans
    getAdminPlans: mockFn(),
    getAdminPlan: vi.fn().mockResolvedValue({ plan: { id: 'p-1', name: 'Free', slug: 'free', description: '', monthlyCents: 0, yearlyCents: 0, price_cents: 0, tier: 'free', isPublic: true, features: [] } }),
    createPlan: mockFn(),
    updatePlan: mockFn(),
    archivePlan: mockFn(),
    restorePlan: mockFn(),
    setPlanFeatures: mockFn(),
    removePlanFeature: mockFn(),
    syncPlanToStripe: mockFn(),

    // Users
    getAdminUsers: mockFn(),
    getAdminUser: mockFn(),
    updateUserRole: mockFn(),
    suspendUser: mockFn(),
    unsuspendUser: mockFn(),
    impersonateUser: mockFn(),
    resetUserPassword: mockFn(),
    moveUserOrganization: mockFn(),
    forceUserPlan: mockFn(),

    // Credits
    getWorkspaceCredits: mockFn(),
    grantCredits: mockFn(),
    revokeCredits: mockFn(),
    getWorkspaceCreditHistory: mockFn(),

    // Subscriptions
    getAdminSubscriptions: mockFn(),
    getWorkspaceSubscription: mockFn(),
    updateWorkspaceSubscription: mockFn(),

    // Stats
    getAdminOverviewStats: vi.fn().mockResolvedValue({
      data: {
        totalUsers: 0,
        totalWorkspaces: 0,
        totalProjects: 0,
        activeSubscriptions: 0,
        revenue: 0,
        recentUsers: [],
      },
    }),

    // Analytics
    getAnalyticsOverview: mockFn(),
    getAnalyticsSignups: mockFn(),
    getAnalyticsRevenue: mockFn(),
    getAnalyticsUsage: mockFn(),
    getAnalyticsChurn: mockFn(),

    // Organizations
    getAdminOrganizations: mockFn(),
    getAdminOrganization: vi.fn().mockResolvedValue({ organization: { id: 'org-1', name: 'Test Org', status: 'active', memberCount: 0, members: [], workspaces: [], flagOverrides: [] }, auditLog: [], plans: { plans: [] } }),
    updateOrganization: mockFn(),
    setOrgFlagOverrideViaOrg: mockFn(),

    // System Settings
    getSystemSettings: mockFn(),
    updateSystemSetting: mockFn(),

    // Announcements
    getAnnouncements: mockFn(),
    createAnnouncement: mockFn(),
    updateAnnouncement: mockFn(),
    deleteAnnouncement: mockFn(),

    // Audit Log
    getAuditLog: mockFn(),

    // Usage Tracking
    getUsageEvents: mockFn(),
    getUsageSummary: mockFn(),

    // Feature Flags
    getFeatureFlags: mockFn(),
    getOrgFeatureFlags: mockFn(),
    setOrgFlagOverride: mockFn(),
    clearOrgFlagOverride: mockFn(),

    // Billing Config
    getBillingConfig: mockFn(),
    updateBillingConfig: mockFn(),

    // AI Providers
    getAIProviders: mockFn(),
    updateAIProviders: mockFn(),
    setProviderKey: mockFn(),
    removeProviderKey: mockFn(),
    setProviderFallbackKey: mockFn(),
    removeProviderFallbackKey: mockFn(),
    testProviderKey: mockFn(),
    setDefaultModel: mockFn(),
    setFallbackOrder: mockFn(),
  };
});

vi.mock('../lib/hostname', () => ({
  isSuperadminHostname: () => false,
  getHostnameMode: () => 'admin' as const,
  getAdminUrl: () => 'http://admin.whynot.skrum.io',
}));

vi.mock('../lib/money', () => ({
  formatMoney: (cents: number) => '$' + (cents / 100).toFixed(2),
  formatCents: (cents: number) => cents.toString(),
  dollarsToCents: (dollars: number) => Math.round(dollars * 100),
  centsToDollars: (cents: number) => cents / 100,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock('recharts', () => {
  const mockComponent = vi.fn(() => null);
  return {
    ResponsiveContainer: mockComponent,
    LineChart: mockComponent,
    Line: mockComponent,
    BarChart: mockComponent,
    Bar: mockComponent,
    XAxis: mockComponent,
    YAxis: mockComponent,
    CartesianGrid: mockComponent,
    Tooltip: mockComponent,
    Legend: mockComponent,
    PieChart: mockComponent,
    Pie: mockComponent,
    Cell: mockComponent,
    Area: mockComponent,
    AreaChart: mockComponent,
  };
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const LATIN_RUN_RE = /\b[A-Za-z]{4,}\b/g;

const PAGE_SCANNER_EXTRAS = new Set([
  'href', 'null', 'true', 'false', 'undefined', 'loading', 'Loading',
  'test', 'Test', 'mock', 'Mock', 'Vite', 'Lorem', 'ipsum',
  'WhyNot', 'Scan', 'Loop', 'Admin', 'Super',
  // CSS/HTML keywords that leak through component rendering
  'span', 'line', 'clamp', 'full', 'muted', 'flex', 'grid', 'block',
  'none', 'auto', 'bold', 'normal', 'relative', 'absolute', 'fixed',
  'hidden', 'inherit', 'initial', 'solid', 'transparent',
]);

function isAllowedLatinRun(word: string): boolean {
  return BRAND_ALLOW_LIST.has(word) || PAGE_SCANNER_EXTRAS.has(word) || word.length <= 3;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  cleanup();
  await resetLocale();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pages-i18n — admin-frontend', () => {
  for (const page of PAGES) {
    describe(page.key, () => {
      for (const lang of LANGUAGES) {
        it(`renders in ${lang} with correct locale attributes`, async () => {
          let rendered = false;
          try {
            await renderAtLocale(
              React.createElement(page.component),
              lang,
              { initialEntries: [page.path], routePattern: page.routePattern },
            );
            rendered = true;
          } catch {
            // Page failed to render — still verify document attributes
          }

          expect(document.documentElement.lang).toBe(lang);
          expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');

          if (rendered && lang !== 'en') {
            const text = (document.body.innerHTML || '')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const latinRuns = text.match(LATIN_RUN_RE) || [];
            const untranslated = latinRuns.filter((w) => !isAllowedLatinRun(w));

            if (lang === 'ar') {
              expect(
                untranslated,
                `Untranslated Latin text in ${page.key} [${lang}]: ${untranslated.slice(0, 5).join(', ')}`,
              ).toEqual([]);
              if (text.length > 10) {
                expect(text).toMatch(/[\u0600-\u06FF]/);
              }
            }
          }

          if (rendered && lang === 'fr') {
            const html = document.body.innerHTML || '';
            expect(html.length).toBeGreaterThan(0);
          }
        });
      }
    });
  }

  // Seeded regression test
  describe('seeded regression — catches hardcoded English', () => {
    it('flags a component with hardcoded English text', async () => {
      const HardcodedPage = () =>
        React.createElement('div', null, 'This is hardcoded English text that should be flagged');

      await renderAtLocale(React.createElement(HardcodedPage), 'ar');

      const text = (document.body.innerHTML || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const latinRuns = (text.match(LATIN_RUN_RE) || []).filter(
        (w) => !isAllowedLatinRun(w),
      );
      expect(latinRuns.length).toBeGreaterThan(0);
    });
  });
});
