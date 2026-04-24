import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';
import fs from 'fs';
import path from 'path';

vi.mock('@/components/ui/dropdown-menu', () => {
  const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const DropdownMenuTrigger = ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>;
  const DropdownMenuContent = ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div role="menu">{children}</div>;
  const DropdownMenuItem = ({
    children,
    onSelect,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  } & Record<string, unknown>) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onSelect && !disabled && onSelect()}
      {...rest}
    >
      {children}
    </button>
  );
  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  };
});

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, string> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

let currentLang = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => {
    const translations = loadJson(currentLang, 'recon');
    return {
      t: (key: string) =>
        typeof translations[key] === 'string'
          ? (translations[key] as string)
          : key,
      i18n: { language: currentLang },
    };
  },
}));

const getReconScanMock = vi.fn();
const listReconFindingsMock = vi.fn();
const listReconArtifactsMock = vi.fn();
const getReconReportMock = vi.fn();
const cancelReconScanMock = vi.fn();
const resumeReconScanMock = vi.fn();

vi.mock('@/services/recon-api', async () => {
  const actual = await vi.importActual<typeof import('@/services/recon-api')>(
    '@/services/recon-api',
  );
  return {
    ...actual,
    getReconScan: (...args: unknown[]) => getReconScanMock(...args),
    listReconFindings: (...args: unknown[]) => listReconFindingsMock(...args),
    listReconArtifacts: (...args: unknown[]) =>
      listReconArtifactsMock(...args),
    getReconReport: (...args: unknown[]) => getReconReportMock(...args),
    cancelReconScan: (...args: unknown[]) => cancelReconScanMock(...args),
    resumeReconScan: (...args: unknown[]) => resumeReconScanMock(...args),
  };
});

import { ReconScanDetailPage } from '../ReconScanDetailPage';
import type {
  ReconFinding,
  ReconScanArtifact,
  ReconScanDetail,
  ReconScanStatus,
} from '@/services/recon-api';

const FIXED_T0 = '2026-04-01T10:00:00.000Z';
const FIXED_T1 = '2026-04-01T10:00:30.000Z';
const FIXED_T2 = '2026-04-01T10:01:00.000Z';

function makeScan(
  overrides: Partial<ReconScanDetail> = {},
): ReconScanDetail {
  return {
    id: 'scan-detail-1',
    workspace_id: 'ws-1',
    project_id: 'proj-1',
    project_name: 'Acme Web',
    environment_id: 'env-1',
    environment_name: 'Staging',
    environment_tag: 'staging',
    target_url: 'https://staging.example.com',
    status: 'running' as ReconScanStatus,
    started_at: FIXED_T0,
    completed_at: null,
    created_at: FIXED_T0,
    total_cost_credits: '1.5',
    duration_seconds: 60,
    severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
    phases: [
      {
        phase: 'fingerprinting',
        status: 'completed',
        started_at: FIXED_T0,
        completed_at: FIXED_T1,
        duration_seconds: 30,
        error_message: null,
      },
      {
        phase: 'discovery',
        status: 'running',
        started_at: FIXED_T2,
        completed_at: null,
        duration_seconds: null,
        error_message: null,
      },
    ],
    ...overrides,
  };
}

function makeFinding(
  overrides: Partial<ReconFinding> = {},
): ReconFinding {
  return {
    id: 'finding-1',
    scan_id: 'scan-detail-1',
    severity: 'high',
    vuln_class: 'injection',
    normalized_endpoint: 'GET /api/users/:id',
    description: 'SQL injection vulnerability in the id parameter.',
    proof_of_concept: {
      kind: 'code',
      language: 'bash',
      content: 'curl -X GET https://target/api/users/1',
    },
    remediation_summary: 'Apply parameterized queries.',
    confirmed_at: FIXED_T2,
    ...overrides,
  };
}

function makeArtifact(
  overrides: Partial<ReconScanArtifact> = {},
): ReconScanArtifact {
  return {
    id: 'art-1',
    scan_id: 'scan-detail-1',
    phase: 'discovery',
    kind: 'raw-json',
    size_bytes: 1024,
    created_at: FIXED_T2,
    download_url: 'https://example.com/artifact-1',
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialPath = '/recon/scan-detail-1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/recon/:scanId"
          element={
            <>
              <ReconScanDetailPage />
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
  getReconScanMock.mockReset();
  listReconFindingsMock.mockReset();
  listReconArtifactsMock.mockReset();
  getReconReportMock.mockReset();
  cancelReconScanMock.mockReset();
  resumeReconScanMock.mockReset();
  listReconFindingsMock.mockResolvedValue({ findings: [] });
  listReconArtifactsMock.mockResolvedValue({ artifacts: [] });
  getReconReportMock.mockResolvedValue({ markdown: '# Report\n\nBody text.' });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReconScanDetailPage — default tab by status', () => {
  it('defaults to phases tab when scan is running', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('phase-timeline')).toBeInTheDocument();
    });
  });

  it('defaults to findings tab when scan is completed', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconFindingsMock.mockResolvedValue({ findings: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('findings-empty')).toBeInTheDocument();
    });
  });
});

describe('ReconScanDetailPage — URL-synced tabs', () => {
  it('reads initial tab from URL and syncs back on change', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconFindingsMock.mockResolvedValue({ findings: [] });
    renderPage('/recon/scan-detail-1?tab=raw');

    await waitFor(() => {
      expect(listReconArtifactsMock).toHaveBeenCalledWith('scan-detail-1');
    });

    const phasesTab = screen.getByRole('tab', { name: 'Phases' });
    await user.click(phasesTab);

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain(
        'tab=phases',
      );
    });
    expect(screen.getByTestId('phase-timeline')).toBeInTheDocument();
  });
});

describe('ReconScanDetailPage — polling', () => {
  it('polls every 5s while scan is running', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    renderPage();

    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalledTimes(3);
    });
  });

  it('does not poll when scan is terminal', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconFindingsMock.mockResolvedValue({ findings: [] });
    renderPage();

    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(getReconScanMock).toHaveBeenCalledTimes(1);
  });

  it('pauses polling when document.visibility is hidden', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    renderPage();

    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalledTimes(1);
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'hidden',
    );
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(getReconScanMock).toHaveBeenCalledTimes(1);

    if (originalDescriptor) {
      Object.defineProperty(document, 'hidden', originalDescriptor);
    } else {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
    }
  });
});

describe('ReconScanDetailPage — stuck banner', () => {
  it('renders the stuck banner when scan status is stuck', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'stuck' }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('stuck-banner')).toBeInTheDocument();
      expect(screen.getByTestId('stuck-resume-cta')).toBeInTheDocument();
    });
  });

  it('does not render the stuck banner for running scans', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    renderPage();
    await waitFor(() => {
      expect(getReconScanMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('stuck-banner')).not.toBeInTheDocument();
  });
});

describe('ReconScanDetailPage — report tab', () => {
  it('shows a not-ready message while scan is running', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    renderPage('/recon/scan-detail-1?tab=report');
    await waitFor(() => {
      expect(screen.getByTestId('report-not-ready')).toBeInTheDocument();
    });
  });

  it('renders the report viewer when scan is completed', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    renderPage('/recon/scan-detail-1?tab=report');
    await waitFor(() => {
      expect(screen.getByTestId('report-viewer')).toBeInTheDocument();
    });
  });
});

describe('ReconScanDetailPage — findings tab', () => {
  it('renders the empty state when there are no findings', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconFindingsMock.mockResolvedValue({ findings: [] });
    renderPage('/recon/scan-detail-1?tab=findings');
    await waitFor(() => {
      expect(screen.getByTestId('findings-empty')).toBeInTheDocument();
    });
  });

  it('renders the finding card list when findings are present', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    const finding = makeFinding();
    listReconFindingsMock.mockResolvedValue({ findings: [finding] });
    renderPage('/recon/scan-detail-1?tab=findings');
    await waitFor(() => {
      expect(
        screen.getByTestId(`finding-card-${finding.id}`),
      ).toBeInTheDocument();
    });
  });

  it('toggles severity filter and persists it to the URL', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconFindingsMock.mockResolvedValue({ findings: [] });
    renderPage('/recon/scan-detail-1?tab=findings');
    await waitFor(() => {
      expect(screen.getByTestId('filter-severity-critical')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-severity-critical'));
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain(
        'severity=critical',
      );
    });
  });
});

describe('ReconScanDetailPage — raw tab artifacts', () => {
  it('requests large-artifact confirmation when size exceeds 10 MB', async () => {
    const originalOpen = window.open;
    const openSpy = vi.fn();
    window.open = openSpy as unknown as typeof window.open;

    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconArtifactsMock.mockResolvedValue({
      artifacts: [makeArtifact({ size_bytes: 11 * 1024 * 1024 })],
    });
    renderPage('/recon/scan-detail-1?tab=raw');

    await waitFor(() => {
      expect(screen.getByTestId('artifact-row-art-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('artifact-download-art-1'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-large-download')).toBeInTheDocument();
    });
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-large-download'));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/artifact-1',
        '_blank',
        'noopener,noreferrer',
      );
    });

    window.open = originalOpen;
  });

  it('downloads directly for small artifacts without confirmation', async () => {
    const originalOpen = window.open;
    const openSpy = vi.fn();
    window.open = openSpy as unknown as typeof window.open;

    getReconScanMock.mockResolvedValue(makeScan({ status: 'completed' }));
    listReconArtifactsMock.mockResolvedValue({
      artifacts: [makeArtifact({ id: 'art-small', size_bytes: 2048 })],
    });
    renderPage('/recon/scan-detail-1?tab=raw');

    await waitFor(() => {
      expect(screen.getByTestId('artifact-row-art-small')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('artifact-download-art-small'));
    expect(openSpy).toHaveBeenCalled();

    window.open = originalOpen;
  });
});

describe('ReconScanDetailPage — actions', () => {
  it('calls cancel API after confirmation', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    cancelReconScanMock.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('scan-actions-menu')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('scan-actions-menu'));
    await waitFor(() => {
      expect(screen.getByTestId('action-cancel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-cancel')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel'));
    });
    await waitFor(() => {
      expect(cancelReconScanMock).toHaveBeenCalledWith('scan-detail-1');
    });
  });

  it('rejects resume when URL does not match original', async () => {
    getReconScanMock.mockResolvedValue(
      makeScan({ status: 'failed', target_url: 'https://ok.example.com' }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('scan-actions-menu')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('scan-actions-menu'));
    await waitFor(() => {
      expect(screen.getByTestId('action-resume')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-resume'));

    const input = (await screen.findByTestId(
      'resume-url-input',
    )) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://different.example.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-resume'));
    });

    expect(resumeReconScanMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('ReconScanDetailPage — snapshots', () => {
  it('matches the running-scan phases-tab snapshot in English', async () => {
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('phase-timeline')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
  });

  it('matches the running-scan phases-tab snapshot in Arabic (RTL)', async () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    getReconScanMock.mockResolvedValue(makeScan({ status: 'running' }));
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('phase-timeline')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
  });
});
