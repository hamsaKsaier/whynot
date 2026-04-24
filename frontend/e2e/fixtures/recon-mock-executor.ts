import type { Page, Route } from '@playwright/test';

/**
 * Fixture for stubbing the Recon API surface in Playwright e2e tests.
 *
 * Instead of standing up gateway + recon-executor, we intercept the HTTP
 * calls the frontend makes via axios (`page.route`) and return deterministic
 * responses from an in-memory state machine. Tests can advance the scan's
 * phase timeline instantly with `advancePhase()` or `completeScan()`.
 *
 * Route glob patterns use `**recon/**` because the frontend's axios client
 * has `baseURL: '/api'` and recon-api.ts uses absolute '/api/...' paths,
 * producing duplicated-prefix URLs like `/api/api/recon/scans` in practice.
 * The broad glob matches both shapes.
 */

export type ReconMockStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stuck';

export type ReconMockPhase =
  | 'fingerprinting'
  | 'discovery'
  | 'vuln_analysis'
  | 'exploitation'
  | 'reporting';

export type ReconMockPhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

interface MockFinding {
  id: string;
  scan_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  vuln_class: 'injection' | 'xss' | 'ssrf' | 'auth' | 'authz';
  normalized_endpoint: string;
  description: string;
  proof_of_concept: {
    kind: 'code' | 'http' | 'script';
    language: string;
    content: string;
    request?: string;
    response?: string;
  };
  remediation_summary: string;
  confirmed_at: string;
}

interface MockScan {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name: string;
  environment_id: string;
  environment_name: string;
  environment_tag: 'production' | 'staging' | 'development';
  target_url: string;
  status: ReconMockStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_cost_credits: string;
  duration_seconds: number | null;
  severity_counts: { critical: number; high: number; medium: number; low: number };
  phases: Array<{
    phase: ReconMockPhase;
    status: ReconMockPhaseStatus;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    error_message: string | null;
  }>;
  findings: MockFinding[];
  report_markdown: string;
}

export interface ReconMockState {
  flags: Record<string, boolean>;
  scans: MockScan[];
  lastCreateRequest: unknown | null;
  lastResumeRequest: { id: string; target_url: string } | null;
  lastCancelId: string | null;
  resumeShouldFail?: boolean;
}

export interface ReconMockOptions {
  /** Enable/disable recon_enabled flag. Default true. */
  flagEnabled?: boolean;
  /** Pre-seed a scan in the list. Default: none. */
  seedScans?: MockScan[];
  /** User id returned by /auth/me. Default: 'user-1'. */
  userId?: string;
}

const PHASE_ORDER: ReconMockPhase[] = [
  'fingerprinting',
  'discovery',
  'vuln_analysis',
  'exploitation',
  'reporting',
];

export function makeSampleFinding(scanId: string): MockFinding {
  return {
    id: 'finding-1',
    scan_id: scanId,
    severity: 'high',
    vuln_class: 'injection',
    normalized_endpoint: 'POST /api/login',
    description:
      'The login endpoint reflects unsanitized input into a SQL query, allowing authenticated bypass.',
    proof_of_concept: {
      kind: 'http',
      language: 'http',
      content: "POST /api/login HTTP/1.1\nContent-Type: application/json\n\n{\"user\":\"admin' OR 1=1 --\"}",
      request: "POST /api/login HTTP/1.1\n\n{\"user\":\"a\"}",
      response: 'HTTP/1.1 200 OK\n\n{"token":"..."}',
    },
    remediation_summary:
      'Use parameterized queries. Never interpolate user input into SQL strings.',
    confirmed_at: new Date().toISOString(),
  };
}

export function makeSampleScan(overrides: Partial<MockScan> = {}): MockScan {
  const id = overrides.id ?? 'scan-1';
  const findings = overrides.findings ?? [makeSampleFinding(id)];
  return {
    id,
    workspace_id: 'ws-1',
    project_id: 'proj-1',
    project_name: 'Acme API',
    environment_id: 'env-1',
    environment_name: 'Staging',
    environment_tag: 'staging',
    target_url: 'https://staging.example.com',
    status: 'pending',
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    total_cost_credits: '0',
    duration_seconds: null,
    severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
    phases: PHASE_ORDER.map((phase) => ({
      phase,
      status: 'pending' as ReconMockPhaseStatus,
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      error_message: null,
    })),
    findings,
    report_markdown:
      '# Scan Report\n\n## Summary\n\nOne high-severity finding was confirmed with a working exploit.\n\n## Findings\n\n### 1. SQL injection on /api/login\n\nThe login endpoint is vulnerable to SQL injection.\n',
    ...overrides,
  };
}

export class ReconMockServer {
  readonly state: ReconMockState;

  constructor(opts: ReconMockOptions = {}) {
    this.state = {
      flags: { recon_enabled: opts.flagEnabled ?? true },
      scans: opts.seedScans ?? [],
      lastCreateRequest: null,
      lastResumeRequest: null,
      lastCancelId: null,
    };
  }

  /** Flip a scan to running with the first phase running. */
  startScan(id: string) {
    const scan = this.state.scans.find((s) => s.id === id);
    if (!scan) return;
    scan.status = 'running';
    scan.started_at = new Date().toISOString();
    scan.phases[0].status = 'running';
    scan.phases[0].started_at = scan.started_at;
  }

  /** Mark current running phase complete and advance to next. */
  advancePhase(id: string) {
    const scan = this.state.scans.find((s) => s.id === id);
    if (!scan) return;
    const now = new Date().toISOString();
    const runningIdx = scan.phases.findIndex((p) => p.status === 'running');
    if (runningIdx === -1) return;
    scan.phases[runningIdx].status = 'completed';
    scan.phases[runningIdx].completed_at = now;
    scan.phases[runningIdx].duration_seconds = 1;
    if (runningIdx + 1 < scan.phases.length) {
      scan.phases[runningIdx + 1].status = 'running';
      scan.phases[runningIdx + 1].started_at = now;
    } else {
      scan.status = 'completed';
      scan.completed_at = now;
      scan.severity_counts.high = scan.findings.filter((f) => f.severity === 'high').length;
      scan.severity_counts.critical = scan.findings.filter((f) => f.severity === 'critical').length;
      scan.severity_counts.medium = scan.findings.filter((f) => f.severity === 'medium').length;
      scan.severity_counts.low = scan.findings.filter((f) => f.severity === 'low').length;
    }
  }

  completeScan(id: string) {
    this.startScan(id);
    // march through all phases
    for (let i = 0; i < PHASE_ORDER.length; i += 1) this.advancePhase(id);
  }

  async install(page: Page, opts: { userId?: string } = {}) {
    const userId = opts.userId ?? 'user-1';

    // Preset auth token so AuthProvider thinks we're logged in.
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'e2e-mock-token');
      localStorage.setItem('active_workspace_id', 'ws-1');
    });

    const ok = (route: Route, body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    // ---- Auth / workspace ----
    await page.route('**/auth/me', (route) =>
      ok(route, {
        success: true,
        user: { id: userId, email: 'owner@example.com', name: 'Owner', role: 'owner' },
      }),
    );

    await page.route('**/me/flags', (route) =>
      ok(route, { success: true, flags: this.state.flags }),
    );

    await page.route('**/workspaces**', (route) =>
      ok(route, {
        workspaces: [
          {
            id: 'ws-1',
            name: 'Acme',
            slug: 'acme',
            role: 'owner',
            is_personal: false,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    );

    // ---- Projects ----
    await page.route('**/projects**', (route) => {
      const url = route.request().url();
      if (url.includes('/projects/')) return route.continue();
      return ok(route, {
        projects: [
          {
            id: 'proj-1',
            name: 'Acme API',
            description: 'Primary API',
            github_repo: 'acme/api',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        offset: 0,
        limit: 200,
        total: 1,
      });
    });

    // ---- Environments ----
    await page.route('**/environments**', (route) =>
      ok(route, {
        environments: [
          {
            id: 'env-1',
            name: 'Staging',
            url: 'https://staging.example.com',
            description: null,
            tag: 'staging',
            project_id: 'proj-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }),
    );

    // ---- Recon quota ----
    await page.route('**/recon/quota', (route) =>
      ok(route, { mode: 'included', remaining: 3, cost_credits: '50' }),
    );

    // ---- Recon scans list ----
    await page.route(/\/recon\/scans(\?|$)/, (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        // Create
        const body = JSON.parse(route.request().postData() ?? '{}');
        this.state.lastCreateRequest = body;
        const newId = `scan-${this.state.scans.length + 1}`;
        const newScan = makeSampleScan({
          id: newId,
          project_id: body.project_id,
          environment_id: body.environment_id,
          target_url: body.target_url,
        });
        this.state.scans.unshift(newScan);
        this.startScan(newId);
        return ok(route, { scan: { id: newId } });
      }

      // GET list
      const url = new URL(route.request().url());
      const tab = url.searchParams.get('tab');
      let filtered = this.state.scans;
      if (tab === 'running') {
        filtered = filtered.filter((s) => s.status === 'running' || s.status === 'pending');
      } else if (tab === 'completed') {
        filtered = filtered.filter((s) => s.status === 'completed');
      } else if (tab === 'failed') {
        filtered = filtered.filter((s) => s.status === 'failed' || s.status === 'stuck');
      }
      return ok(route, { scans: filtered, next_cursor: null });
    });

    // ---- Recon scan detail + sub-resources ----
    await page.route(/\/recon\/scans\/[^/]+/, (route) => {
      const url = route.request().url();
      const match = url.match(/\/recon\/scans\/([^/?]+)(\/[^?]*)?/);
      const id = match?.[1] ?? '';
      const sub = match?.[2] ?? '';
      const method = route.request().method();
      const scan = this.state.scans.find((s) => s.id === id);

      if (!scan) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'not found' }),
        });
      }

      if (sub === '/cancel' && method === 'POST') {
        this.state.lastCancelId = id;
        scan.status = 'cancelled';
        return ok(route, { success: true });
      }

      if (sub === '/resume' && method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        this.state.lastResumeRequest = { id, target_url: body.target_url };
        if (this.state.resumeShouldFail || body.target_url !== scan.target_url) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'URL must match the original target exactly.',
            }),
          });
        }
        scan.status = 'pending';
        return ok(route, { success: true });
      }

      if (sub === '/findings') {
        return ok(route, { findings: scan.findings });
      }

      if (sub === '/report') {
        return ok(route, { markdown: scan.report_markdown });
      }

      if (sub === '/artifacts') {
        return ok(route, { artifacts: [] });
      }

      // default: scan detail
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { findings: _f, report_markdown: _r, ...detail } = scan;
      return ok(route, {
        ...detail,
        phases: scan.phases,
        authorization: {
          justification: 'authorized e2e run',
          acknowledged_by_user_id: userId,
          acknowledged_at: new Date().toISOString(),
        },
      });
    });
  }
}

/** Assert rendered page HTML contains none of the banned strings. */
export const BANNED_VOCABULARY = [
  'Shannon',
  'KeygraphHQ',
  'nmap',
  'subfinder',
  'whatweb',
  'schemathesis',
  'Playwright',
  'Anthropic',
  'Claude',
] as const;

export async function assertNoBannedVocabulary(page: Page, scope?: string) {
  // `page.content()` returns the serialized DOM; strip inline script content
  // because bundler chunk names can contain unrelated substrings.
  const html = scope
    ? await page.locator(scope).innerHTML()
    : await page.content();
  const stripped = html.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const term of BANNED_VOCABULARY) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(stripped)) {
      throw new Error(`banned vocabulary "${term}" appears in rendered output`);
    }
  }
}
