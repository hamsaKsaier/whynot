import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, string> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

let currentLang = 'en';

function interpolate(s: string, opts?: Record<string, unknown>): string {
  if (!opts) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    opts[k] != null ? String(opts[k]) : `{{${k}}}`,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => {
    const translations = loadJson(currentLang, 'recon');
    return {
      t: (key: string, opts?: Record<string, unknown>) =>
        typeof translations[key] === 'string'
          ? interpolate(translations[key] as string, opts)
          : key,
      i18n: { language: currentLang },
    };
  },
}));

// Radix Select relies on pointer events + hasPointerCapture that jsdom doesn't
// implement. Replace it with a plain HTML <select> for deterministic testing.
vi.mock('@/components/ui/select', () => {
  type SelectCtx = {
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    triggerId?: string;
  };
  const ctx: { current: SelectCtx | null } = { current: null };

  const collectItems = (
    children: React.ReactNode,
    out: Array<{ value: string; label: React.ReactNode }>,
  ) => {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const el = child as React.ReactElement<{
        value?: string;
        children?: React.ReactNode;
      }>;
      const typeAny = el.type as { displayName?: string; name?: string };
      const tag = typeAny.displayName || typeAny.name;
      if (tag === 'SelectItem' && el.props.value != null) {
        out.push({ value: el.props.value, label: el.props.children });
      } else if (el.props && el.props.children) {
        collectItems(el.props.children, out);
      }
    });
  };

  const Select = ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => {
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    collectItems(children, items);
    ctx.current = {
      value: value ?? '',
      onValueChange: onValueChange ?? (() => {}),
      disabled,
    };
    // Render children so tests can assert on trigger testids, then hidden
    // <select> for programmatic interaction via fireEvent.change.
    return (
      <div>
        {children}
        <select
          data-testid="__native_select"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onValueChange?.(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0 }}
        >
          <option value="" />
          {items.map((item, i) => (
            <option key={i} value={item.value}>
              {typeof item.label === 'string' ? item.label : item.value}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const SelectTrigger = ({
    children,
    id,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    id?: string;
    'data-testid'?: string;
  }) => (
    <button type="button" id={id} data-testid={testId} role="combobox">
      {children}
    </button>
  );
  SelectTrigger.displayName = 'SelectTrigger';

  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );
  SelectValue.displayName = 'SelectValue';

  const SelectContent = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  SelectContent.displayName = 'SelectContent';

  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => (
    <div role="option" data-value={value}>
      {children}
    </div>
  );
  SelectItem.displayName = 'SelectItem';

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

// ---- API + auth mocks --------------------------------------------------

const getProjectsMock = vi.fn();
const getEnvironmentsMock = vi.fn();

vi.mock('@/services/api', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return {
    ...actual,
    getProjects: (...args: unknown[]) => getProjectsMock(...args),
    getEnvironments: (...args: unknown[]) => getEnvironmentsMock(...args),
  };
});

const createReconScanMock = vi.fn();
const getReconQuotaMock = vi.fn();

vi.mock('@/services/recon-api', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/recon-api')>(
      '@/services/recon-api',
    );
  return {
    ...actual,
    createReconScan: (...args: unknown[]) => createReconScanMock(...args),
    getReconQuota: (...args: unknown[]) => getReconQuotaMock(...args),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      avatarUrl: null,
      role: 'owner',
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { ReconNewScanPage } from '../ReconNewScanPage';

function makeProjects() {
  return {
    projects: [
      {
        id: 'proj-with-repo',
        name: 'Acme Web',
        description: null,
        website_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        user_story_count: 0,
        has_repo: true,
      },
      {
        id: 'proj-no-repo',
        name: 'No Repo Project',
        description: null,
        website_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        user_story_count: 0,
        has_repo: false,
      },
    ],
    offset: 0,
    limit: 50,
    total: 2,
  };
}

function makeEnvironments() {
  return {
    environments: [
      {
        id: 'env-prod',
        workspace_id: 'ws-1',
        name: 'Production Main',
        url: 'https://app.example.com',
        description: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'env-staging',
        workspace_id: 'ws-1',
        name: 'Staging',
        url: 'https://staging.example.com',
        description: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'env-no-url',
        workspace_id: 'ws-1',
        name: 'Local no URL',
        url: '',
        description: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function renderPage(initialPath = '/recon/new') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/recon/new"
          element={
            <>
              <ReconNewScanPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/recon"
          element={<div data-testid="list-page" />}
        />
        <Route
          path="/recon/:scanId"
          element={
            <>
              <div data-testid="detail-page" />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  currentLang = 'en';
  getProjectsMock.mockReset();
  getEnvironmentsMock.mockReset();
  createReconScanMock.mockReset();
  getReconQuotaMock.mockReset();
  getProjectsMock.mockResolvedValue(makeProjects());
  getEnvironmentsMock.mockResolvedValue(makeEnvironments());
  getReconQuotaMock.mockResolvedValue({
    mode: 'included',
    remaining: 3,
    cost_credits: '0',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function nativeSelects() {
  const list = screen.getAllByTestId('__native_select');
  return { project: list[0] as HTMLSelectElement, env: list[1] as HTMLSelectElement };
}

describe('ReconNewScanPage — step 1 target selection', () => {
  it('renders the wizard title and step indicator', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-1')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { name: 'New scan', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-indicator')).toBeInTheDocument();
  });

  it('filters out projects without a GitHub repo', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });
    const optionTexts = screen
      .getAllByRole('option')
      .map((o) => o.textContent || '');
    expect(optionTexts).toContain('Acme Web');
    expect(optionTexts).not.toContain('No Repo Project');
  });

  it('filters out environments without a target URL', async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByTestId('wizard-environment-select'),
      ).toBeInTheDocument();
    });
    const options = screen
      .getAllByRole('option')
      .map((o) => o.textContent || '');
    expect(options.some((o) => o.includes('Staging'))).toBe(true);
    expect(options.some((o) => o.includes('Production Main'))).toBe(true);
    expect(options.some((o) => o.includes('Local no URL'))).toBe(false);
  });

  it('shows the production warning when a production environment is selected (without blocking)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });

    const { project, env } = nativeSelects();
    fireEvent.change(project, { target: { value: 'proj-with-repo' } });
    fireEvent.change(env, { target: { value: 'env-prod' } });

    await waitFor(() => {
      expect(screen.getByTestId('production-warning')).toBeInTheDocument();
    });

    // Continue button remains enabled — warning does NOT block.
    expect(screen.getByTestId('wizard-step1-continue')).not.toBeDisabled();
  });

  it('advances to step 2 via URL query param', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });

    const { project, env } = nativeSelects();
    fireEvent.change(project, { target: { value: 'proj-with-repo' } });
    fireEvent.change(env, { target: { value: 'env-staging' } });

    await user.click(screen.getByTestId('wizard-step1-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('step=2');
    });
    expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
  });
});

describe('ReconNewScanPage — step 2 authorization', () => {
  it('disables Continue when switch is off', async () => {
    renderPage('/recon/new?step=2');
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step2-continue')).toBeDisabled();
  });

  it('disables Continue when justification is 19 chars, enables at 20', async () => {
    const user = userEvent.setup();
    renderPage('/recon/new?step=2');
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
    });
    // Acknowledge
    const sw = screen.getByTestId('wizard-ack-switch');
    await user.click(sw);

    const input = screen.getByTestId(
      'wizard-justification-input',
    ) as HTMLTextAreaElement;
    fireEvent.change(input, {
      target: { value: 'a'.repeat(19) },
    });
    expect(screen.getByTestId('wizard-step2-continue')).toBeDisabled();
    expect(screen.getByTestId('wizard-justification-error').textContent).toBe(
      'Justification must be at least 20 characters.',
    );

    fireEvent.change(input, { target: { value: 'a'.repeat(20) } });
    expect(screen.getByTestId('wizard-step2-continue')).not.toBeDisabled();
  });

  it('clamps justification input to 1000 characters', async () => {
    renderPage('/recon/new?step=2');
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
    });

    const input = screen.getByTestId(
      'wizard-justification-input',
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'a'.repeat(1001) } });
    expect(input.value.length).toBe(1000);
  });

  it('Switch element does NOT include min-h-[44px] / min-w-[44px] classes', async () => {
    renderPage('/recon/new?step=2');
    await waitFor(() => {
      expect(screen.getByTestId('wizard-ack-switch')).toBeInTheDocument();
    });
    const sw = screen.getByTestId('wizard-ack-switch');
    expect(sw.className).not.toMatch(/min-h-\[44px\]/);
    expect(sw.className).not.toMatch(/min-w-\[44px\]/);
  });
});

describe('ReconNewScanPage — step 3 review & submit', () => {
  async function advanceToStep3(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });
    const { project, env } = nativeSelects();
    fireEvent.change(project, { target: { value: 'proj-with-repo' } });
    fireEvent.change(env, { target: { value: 'env-staging' } });
    await user.click(screen.getByTestId('wizard-step1-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('wizard-ack-switch'));
    const input = screen.getByTestId('wizard-justification-input');
    fireEvent.change(input, {
      target: {
        value:
          'Routine authorized security review per ticket SEC-101 and change window.',
      },
    });
    await user.click(screen.getByTestId('wizard-step2-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-3')).toBeInTheDocument();
    });
  }

  it('renders summary with selected project, env, and URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await advanceToStep3(user);

    expect(screen.getByTestId('wizard-summary-project').textContent).toBe(
      'Acme Web',
    );
    expect(screen.getByTestId('wizard-summary-environment').textContent).toBe(
      'Staging',
    );
    expect(screen.getByTestId('wizard-summary-url').textContent).toBe(
      'https://staging.example.com',
    );
  });

  it('shows "included" cost preview when quota has remaining credits', async () => {
    const user = userEvent.setup();
    renderPage();
    await advanceToStep3(user);

    await waitFor(() => {
      expect(screen.getByTestId('wizard-cost-preview').textContent).toContain(
        '3',
      );
    });
    expect(screen.getByTestId('wizard-cost-preview').textContent).toContain(
      'Included scans',
    );
  });

  it('shows PAYG cost preview when in payg mode', async () => {
    getReconQuotaMock.mockResolvedValue({
      mode: 'payg',
      remaining: 0,
      cost_credits: '5',
    });
    const user = userEvent.setup();
    renderPage();
    await advanceToStep3(user);

    await waitFor(() => {
      expect(screen.getByTestId('wizard-cost-preview').textContent).toContain(
        '5 credits',
      );
    });
  });

  it('submits POST with the full authorization block and navigates to the scan detail', async () => {
    createReconScanMock.mockResolvedValue({ scan: { id: 'scan-123' } });
    const user = userEvent.setup();
    renderPage();
    await advanceToStep3(user);

    await user.click(screen.getByTestId('wizard-step3-submit'));

    await waitFor(() => {
      expect(createReconScanMock).toHaveBeenCalledTimes(1);
    });
    const payload = createReconScanMock.mock.calls[0][0];
    expect(payload.project_id).toBe('proj-with-repo');
    expect(payload.environment_id).toBe('env-staging');
    expect(payload.target_url).toBe('https://staging.example.com');
    expect(payload.authorization).toMatchObject({
      acknowledged: true,
      acknowledged_by_user_id: 'user-1',
    });
    expect(payload.authorization.justification.length).toBeGreaterThanOrEqual(
      20,
    );
    expect(typeof payload.authorization.acknowledged_at).toBe('string');

    await waitFor(() => {
      expect(screen.getByTestId('detail-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location').textContent).toBe(
      '/recon/scan-123',
    );
  });

  it('surfaces localized error on 4xx response', async () => {
    createReconScanMock.mockRejectedValue(
      new Error('Recon feature is not enabled on this workspace.'),
    );
    const user = userEvent.setup();
    renderPage();
    await advanceToStep3(user);

    await user.click(screen.getByTestId('wizard-step3-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-submit-error').textContent).toBe(
        'Recon feature is not enabled on this workspace.',
      );
    });
    // Stays on step 3
    expect(screen.getByTestId('wizard-step-3')).toBeInTheDocument();
  });
});

describe('ReconNewScanPage — discard guard', () => {
  it('opens discard dialog when Cancel is clicked with unsaved input', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });
    const { project } = nativeSelects();
    fireEvent.change(project, { target: { value: 'proj-with-repo' } });

    await user.click(screen.getByTestId('wizard-cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('wizard-discard-confirm')).toBeInTheDocument();
    });
  });

  it('confirming discard navigates back to /recon', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-project-select')).toBeInTheDocument();
    });
    const { project } = nativeSelects();
    fireEvent.change(project, { target: { value: 'proj-with-repo' } });

    await user.click(screen.getByTestId('wizard-cancel'));
    await user.click(await screen.findByTestId('wizard-discard-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument();
    });
  });

  it('Cancel without unsaved input navigates directly to /recon without the dialog', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-cancel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('wizard-cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('list-page')).toBeInTheDocument();
    });
  });
});

describe('ReconNewScanPage — snapshot', () => {
  it('matches en snapshot on step 1', async () => {
    currentLang = 'en';
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-1')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
  });

  it('matches ar (RTL) snapshot on step 2', async () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    const { container } = renderPage('/recon/new?step=2');
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step-2')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
  });
});
