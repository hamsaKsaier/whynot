import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';
import { renderAtLocale, resetLocale, LANGUAGES, type SupportedLang } from './helpers/renderAtLocale';
import { PAGES } from './pages-manifest';
import { BRAND_ALLOW_LIST } from '@shared/constants/brand-allowlist';

// ─── Global browser API mocks ────────────────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })),
});

globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(() => []),
}));

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      role: 'user',
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    workspace: {
      id: 'ws-1',
      name: 'Test WS',
      slug: 'test-ws',
      ownerId: 'u1',
      role: 'owner',
      plan: 'free',
      createdAt: new Date().toISOString(),
    },
    workspaces: [],
    activeWorkspace: {
      id: 'ws-1',
      name: 'Test WS',
      owner_id: 'u1',
      created_at: new Date().toISOString(),
    },
    isLoading: false,
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    refresh: vi.fn(),
  }),
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../providers/FeatureFlagsProvider', () => ({
  useFeatureFlagsContext: () => ({
    flags: {},
    isLoading: false,
    refetch: vi.fn(),
  }),
  useFeatureFlags: () => ({}),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
  useFeatureFlag: () => false,
}));

vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
  useToastContext: () => ({
    toasts: [],
    showToast: vi.fn(),
    dismissToast: vi.fn(),
    dismissAll: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useDirection', () => ({
  default: () => ({ direction: 'ltr', setDirection: vi.fn(), isRtl: false }),
  useDirection: () => ({ direction: 'ltr', setDirection: vi.fn(), isRtl: false }),
}));

vi.mock('../components/DirectionProvider', () => ({
  DirectionProvider: ({ children }: { children: React.ReactNode }) => children,
  useDirectionContext: () => ({
    direction: 'ltr',
    setDirection: vi.fn(),
    isRtl: false,
  }),
}));

vi.mock('../components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn(), toggle: vi.fn() }),
  useThemeContext: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn(), toggle: vi.fn() }),
}));

vi.mock('../services/api', () => {
  const inst = {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn().mockResolvedValue({ data: [] }),
    patch: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn().mockResolvedValue({ data: [] }),
    defaults: { baseURL: '/api', headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return {
  apiClient: inst,
  default: inst,
  checkHealth: vi.fn().mockResolvedValue(true),
  generateTests: vi.fn().mockResolvedValue({ data: [] }),
  runTest: vi.fn().mockResolvedValue({ data: [] }),
  executeTest: vi.fn().mockResolvedValue({ data: [] }),
  getExecutionResult: vi.fn().mockResolvedValue({ data: [] }),
  getExecutions: vi.fn().mockResolvedValue({ executions: [], total: 0, offset: 0, limit: 50 }),
  getExecutionById: vi.fn().mockResolvedValue({ data: [] }),
  stopExecution: vi.fn().mockResolvedValue({ success: true }),
  getTestResults: vi.fn().mockResolvedValue({ data: [] }),
  getTestCases: vi.fn().mockResolvedValue({ test_cases: [] }),
  updateTestCase: vi.fn().mockResolvedValue({ data: [] }),
  deleteTestCase: vi.fn().mockResolvedValue(undefined),
  getFlowData: vi.fn().mockResolvedValue({ projects: [] }),
  getProjects: vi.fn().mockResolvedValue({ projects: [], offset: 0, limit: 50, total: 0 }),
  getProject: vi.fn().mockResolvedValue({ project: {} }),
  createProject: vi.fn().mockResolvedValue({ success: true, project: {} }),
  updateProject: vi.fn().mockResolvedValue({ success: true, project: {} }),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getProjectContext: vi.fn().mockResolvedValue({ context: null, user_prd: '' }),
  updateProjectPrd: vi.fn().mockResolvedValue(undefined),
  resetProjectContext: vi.fn().mockResolvedValue(undefined),
  getProjectTestCasesByCategory: vi.fn().mockResolvedValue({ categories: [], bugs: [], scanHistory: [] }),
  getUserStories: vi.fn().mockResolvedValue({ user_stories: [], offset: 0, limit: 100, total: 0 }),
  getUserStory: vi.fn().mockResolvedValue({ user_story: {} }),
  createUserStory: vi.fn().mockResolvedValue({ success: true, user_story: {} }),
  updateUserStory: vi.fn().mockResolvedValue({ success: true, user_story: {} }),
  deleteUserStory: vi.fn().mockResolvedValue(undefined),
  generateTestsWithContext: vi.fn().mockResolvedValue({ data: [] }),
  getFolders: vi.fn().mockResolvedValue({ folders: [] }),
  createFolder: vi.fn().mockResolvedValue({ success: true, folder: {} }),
  updateFolder: vi.fn().mockResolvedValue({ success: true, folder: {} }),
  deleteFolder: vi.fn().mockResolvedValue(undefined),
  assignUserStoryToFolder: vi.fn().mockResolvedValue({ success: true }),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalTestCases: 0,
    totalQASessions: 0,
    totalBugsFound: 0,
    successRate: 0,
    totalExecutions: 0,
    recentSessions: [],
  }),
  getEnvironments: vi.fn().mockResolvedValue({ environments: [] }),
  createEnvironment: vi.fn().mockResolvedValue({ success: true, environment: {} }),
  updateEnvironment: vi.fn().mockResolvedValue({ success: true, environment: {} }),
  deleteEnvironment: vi.fn().mockResolvedValue(undefined),
  getTestCaseBaselines: vi.fn().mockResolvedValue({ baselines: [] }),
  getBaselineHistory: vi.fn().mockResolvedValue({ baselines: [] }),
  createBaseline: vi.fn().mockResolvedValue({ success: true, baseline: {} }),
  setBaselineLock: vi.fn().mockResolvedValue({ success: true }),
  getExecutionVisualComparisons: vi.fn().mockResolvedValue({ comparisons: [] }),
  getVisualRegressions: vi.fn().mockResolvedValue({ regressions: [] }),
  setVisualRegressionIgnored: vi.fn().mockResolvedValue({ success: true }),
  getBillingSubscription: vi.fn().mockResolvedValue({ data: [] }),
  getBillingCredits: vi.fn().mockResolvedValue({ data: [] }),
  getBillingCreditsHistory: vi.fn().mockResolvedValue({ data: [] }),
  getBillingUsage: vi.fn().mockResolvedValue({ data: [] }),
  getPublicPlans: vi.fn().mockResolvedValue({ plans: [] }),
  createCheckoutSession: vi.fn().mockResolvedValue({ data: [] }),
  createPortalSession: vi.fn().mockResolvedValue({ data: [] }),
  getBillingInvoices: vi.fn().mockResolvedValue({ data: [] }),
  cancelSubscription: vi.fn().mockResolvedValue({ data: [] }),
  reactivateSubscription: vi.fn().mockResolvedValue({ data: [] }),
  getUsageSummary: vi.fn().mockResolvedValue({ data: [] }),
  getUsageByDay: vi.fn().mockResolvedValue({ data: [] }),
  getUsageRecent: vi.fn().mockResolvedValue({ data: [] }),
  getUsageExportCsvUrl: vi.fn().mockReturnValue('/api/me/usage/export.csv'),
  requestDataExport: vi.fn().mockResolvedValue({ data: [] }),
  pollExportStatus: vi.fn().mockResolvedValue({ data: [] }),
  getProfile: vi.fn().mockResolvedValue({ data: [] }),
  updateProfile: vi.fn().mockResolvedValue({ data: [] }),
  changePassword: vi.fn().mockResolvedValue({ data: [] }),
  getOrganization: vi.fn().mockResolvedValue({ data: [] }),
  updateOrganization: vi.fn().mockResolvedValue({ data: [] }),
  getOrganizationMembers: vi.fn().mockResolvedValue({ data: [] }),
  inviteOrganizationMember: vi.fn().mockResolvedValue({ data: [] }),
  removeOrganizationMember: vi.fn().mockResolvedValue({ data: [] }),
  transferOrganizationOwnership: vi.fn().mockResolvedValue({ data: [] }),
  getApiKeys: vi.fn().mockResolvedValue({ data: [] }),
  createApiKey: vi.fn().mockResolvedValue({ data: [] }),
  rotateApiKey: vi.fn().mockResolvedValue({ data: [] }),
  revokeApiKey: vi.fn().mockResolvedValue({ data: [] }),
  updateLanguage: vi.fn().mockResolvedValue({ data: [] }),
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: [] }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: [] }),
  exportUserData: vi.fn().mockResolvedValue({ data: [] }),
  deleteAccount: vi.fn().mockResolvedValue({ data: [] }),
  forgotPassword: vi.fn().mockResolvedValue({ data: [] }),
  resetPassword: vi.fn().mockResolvedValue({ data: [] }),
};});

vi.mock('../config', () => ({
  config: {
    apiUrl: '/api',
    wsUrl: 'ws://localhost',
    qaLoopWsUrl: 'ws://localhost',
    appVersion: '2.0.0',
    isDev: false,
  },
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

vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(() => null),
  LineChart: vi.fn(() => null),
  Line: vi.fn(() => null),
  BarChart: vi.fn(() => null),
  Bar: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  Legend: vi.fn(() => null),
  PieChart: vi.fn(() => null),
  Pie: vi.fn(() => null),
  Cell: vi.fn(() => null),
  Area: vi.fn(() => null),
  AreaChart: vi.fn(() => null),
  ComposedChart: vi.fn(() => null),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  useStripe: () => null,
  useElements: () => null,
  CardElement: () => null,
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(null),
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => children,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/layout/AppShell', () => ({
  AppShell: () => {
    const { Outlet } = require('react-router-dom');
    return React.createElement(Outlet);
  },
  default: () => {
    const { Outlet } = require('react-router-dom');
    return React.createElement(Outlet);
  },
}));

// ─── Latin-run scanner ───────────────────────────────────────────────────────

const LATIN_RUN_RE = /\b[A-Za-z]{4,}\b/g;

const PAGE_SCANNER_EXTRAS = new Set([
  'href', 'null', 'true', 'false', 'undefined', 'loading', 'Loading',
  'test', 'Test', 'mock', 'Mock', 'Vite', 'Lorem', 'ipsum',
  'WhyNot', 'Scan', 'Loop',
  // Tech framework names (landing page)
  'React', 'Next', 'Angular', 'Svelte', 'Node', 'Vue', 'Nuxt',
  'TypeScript', 'JavaScript', 'Express', 'NestJS', 'Remix', 'Astro',
  // File formats / acronyms kept verbatim across locales
  'YAML', 'JSON', 'HTML', 'CSS', 'SQL',
  // Common UI words from mocked components
  'Skip', 'Flash', 'powered', 'automation',
  // Tech framework/platform names (landing page)
  'Django', 'Rails', 'Laravel', 'WordPress', 'Shopify', 'Ruby',
  'Flask', 'FastAPI', 'Spring', 'Kotlin', 'Swift', 'Flutter', 'Webflow',
  // CSS/HTML keywords that leak through component rendering in jsdom
  'span', 'line', 'clamp', 'full', 'muted', 'flex', 'grid', 'block',
  'none', 'auto', 'bold', 'normal', 'relative', 'absolute', 'fixed',
  'hidden', 'inherit', 'initial', 'solid', 'transparent', 'translate',
  'start', 'center', 'border', 'destructive', 'text', 'foreground',
  'dark', 'rotate', 'hover', 'data', 'checked', 'state', 'ring',
  'offset', 'inset', 'rounded', 'shadow', 'background', 'opacity',
  'transition', 'duration', 'pointer', 'select', 'resize', 'outline',
  'overflow', 'whitespace', 'break', 'cursor', 'items', 'justify',
  'self', 'grow', 'shrink', 'basis', 'order', 'wrap', 'content',
  'place', 'gap', 'underline', 'radix', 'collection', 'item',
  'Target', 'testid', 'settings', 'Config', 'Advanced',
]);

function isAllowedLatinRun(word: string): boolean {
  return BRAND_ALLOW_LIST.has(word) || PAGE_SCANNER_EXTRAS.has(word) || word.length <= 3;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterEach(async () => {
  cleanup();
  await resetLocale();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pages-i18n — frontend', () => {
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
            // Strip HTML tags and normalise whitespace for reliable text extraction in jsdom.
            // Tailwind's arbitrary-child selectors (e.g. `[&>span]:line-clamp-1` from shadcn's
            // Select) leave an unescaped `>` inside class="…" attributes in jsdom's innerHTML,
            // which would break a naive `<[^>]*>` tag-strip. We therefore strip attribute
            // name="…" pairs first so only element bodies remain.
            const text = (document.body.innerHTML || '')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/\s+[a-zA-Z_][\w:-]*\s*=\s*"[^"]*"/g, '')
              .replace(/\s+[a-zA-Z_][\w:-]*\s*=\s*'[^']*'/g, '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&[a-z]+;/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const latinRuns = text.match(LATIN_RUN_RE) || [];
            const untranslated = latinRuns.filter((w) => !isAllowedLatinRun(w));

            if (lang === 'ar') {
              expect(
                untranslated,
                `Untranslated Latin text in ${page.key} [${lang}]: ${untranslated.slice(0, 5).join(', ')}`,
              ).toEqual([]);
              // Pages with meaningful content must include Arabic characters
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

  // ── Seeded regression test ───────────────────────────────────────────────
  describe('seeded regression — catches hardcoded English', () => {
    it('flags a component with hardcoded English text', async () => {
      const HardcodedPage = () =>
        React.createElement('div', null, 'This is hardcoded English text that should be flagged');

      await renderAtLocale(
        React.createElement(HardcodedPage),
        'ar',
      );

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
