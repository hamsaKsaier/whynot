import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
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

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => {
    const translations = loadJson(currentLang, 'recon');
    return {
      t: (key: string) =>
        typeof translations[key] === 'string' ? (translations[key] as string) : key,
      i18n: { language: currentLang },
    };
  },
}));

const listReconScansMock = vi.fn();
const cancelReconScanMock = vi.fn();
const resumeReconScanMock = vi.fn();

vi.mock('@/services/recon-api', async () => {
  const actual = await vi.importActual<typeof import('@/services/recon-api')>(
    '@/services/recon-api',
  );
  return {
    ...actual,
    listReconScans: (...args: unknown[]) => listReconScansMock(...args),
    cancelReconScan: (...args: unknown[]) => cancelReconScanMock(...args),
    resumeReconScan: (...args: unknown[]) => resumeReconScanMock(...args),
  };
});

import { ReconScansListPage } from '../ReconScansListPage';
import type { ReconScanListItem } from '@/services/recon-api';

function makeScan(overrides: Partial<ReconScanListItem> = {}): ReconScanListItem {
  return {
    id: 'scan-1',
    workspace_id: 'ws-1',
    project_id: 'proj-1',
    project_name: 'Acme Web',
    environment_id: 'env-1',
    environment_name: 'Staging',
    environment_tag: 'staging',
    target_url: 'https://staging.example.com',
    status: 'running',
    started_at: new Date(Date.now() - 60_000).toISOString(),
    completed_at: null,
    created_at: new Date(Date.now() - 120_000).toISOString(),
    total_cost_credits: '1.5',
    duration_seconds: 60,
    severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialPath = '/recon') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/recon"
          element={
            <>
              <ReconScansListPage />
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
  listReconScansMock.mockReset();
  cancelReconScanMock.mockReset();
  resumeReconScanMock.mockReset();
  listReconScansMock.mockResolvedValue({ scans: [], next_cursor: null });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReconScansListPage — empty & loading', () => {
  it('renders the skeleton loading state initially', async () => {
    let resolveFn: (v: { scans: ReconScanListItem[]; next_cursor: null }) => void = () => {};
    listReconScansMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    renderPage();
    expect(screen.getByTestId('scans-loading')).toBeInTheDocument();
    await act(async () => {
      resolveFn({ scans: [], next_cursor: null });
    });
  });

  it('renders the empty state when the API returns no scans', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('scans-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No scans yet')).toBeInTheDocument();
  });
});

describe('ReconScansListPage — tabs', () => {
  it('defaults to the running tab and passes tab=running to the API', async () => {
    renderPage();
    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalled();
    });
    const firstCall = listReconScansMock.mock.calls[0][0];
    expect(firstCall.tab).toBe('running');
  });

  it('switches tab → updates URL → API called with new filter', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(1);
    });

    const completedTab = screen.getByRole('tab', { name: 'Completed' });
    await user.click(completedTab);

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('tab=completed');
    });
    await waitFor(() => {
      const lastCall = listReconScansMock.mock.calls.at(-1)?.[0];
      expect(lastCall?.tab).toBe('completed');
    });
  });

  it('reads initial tab from URL search params', async () => {
    renderPage('/recon?tab=failed');
    await waitFor(() => {
      const firstCall = listReconScansMock.mock.calls[0][0];
      expect(firstCall.tab).toBe('failed');
    });
  });
});

describe('ReconScansListPage — polling', () => {
  it('polls every 10s while a running scan is in the list', async () => {
    const runningScan = makeScan({ status: 'running' });
    listReconScansMock.mockResolvedValue({ scans: [runningScan], next_cursor: null });
    renderPage();

    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${runningScan.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(3);
    });
  });

  it('stops polling when no running/pending scans remain', async () => {
    const completedScan = makeScan({ id: 'done', status: 'completed' });
    listReconScansMock.mockResolvedValue({ scans: [completedScan], next_cursor: null });
    renderPage();

    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(listReconScansMock).toHaveBeenCalledTimes(1);
  });

  it('pauses polling when document.visibility is hidden', async () => {
    const runningScan = makeScan({ status: 'running' });
    listReconScansMock.mockResolvedValue({ scans: [runningScan], next_cursor: null });
    renderPage();

    await waitFor(() => {
      expect(listReconScansMock).toHaveBeenCalledTimes(1);
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
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

    expect(listReconScansMock).toHaveBeenCalledTimes(1);

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

describe('ReconScansListPage — cancel action', () => {
  it('opens the confirm dialog, calls the cancel API, and optimistically updates the row', async () => {
    const runningScan = makeScan({ id: 'r-1', status: 'running' });
    listReconScansMock.mockResolvedValueOnce({ scans: [runningScan], next_cursor: null });
    listReconScansMock.mockResolvedValue({
      scans: [{ ...runningScan, status: 'cancelled' }],
      next_cursor: null,
    });
    cancelReconScanMock.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${runningScan.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`action-cancel-${runningScan.id}`));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Cancel this scan?')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel'));
    });

    await waitFor(() => {
      expect(cancelReconScanMock).toHaveBeenCalledWith('r-1');
    });
  });
});

describe('ReconScansListPage — resume action', () => {
  it('blocks resume when the URL field is empty', async () => {
    const failedScan = makeScan({ id: 'f-1', status: 'failed' });
    listReconScansMock.mockResolvedValue({ scans: [failedScan], next_cursor: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${failedScan.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`action-resume-${failedScan.id}`));

    const input = (await screen.findByTestId('resume-url-input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    const confirmBtn = screen.getByTestId('confirm-resume') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    expect(resumeReconScanMock).not.toHaveBeenCalled();
  });

  it('rejects URL mismatch with a visible error message', async () => {
    const failedScan = makeScan({
      id: 'f-2',
      status: 'failed',
      target_url: 'https://original.example.com',
    });
    listReconScansMock.mockResolvedValue({ scans: [failedScan], next_cursor: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${failedScan.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`action-resume-${failedScan.id}`));
    const input = (await screen.findByTestId('resume-url-input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://different.example.com' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-resume'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/exactly/i);
    expect(resumeReconScanMock).not.toHaveBeenCalled();
  });

  it('calls the resume API when URL matches the original', async () => {
    const failedScan = makeScan({
      id: 'f-3',
      status: 'failed',
      target_url: 'https://ok.example.com',
    });
    listReconScansMock.mockResolvedValue({ scans: [failedScan], next_cursor: null });
    resumeReconScanMock.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${failedScan.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`action-resume-${failedScan.id}`));
    await screen.findByTestId('resume-url-input');

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-resume'));
    });

    await waitFor(() => {
      expect(resumeReconScanMock).toHaveBeenCalledWith('f-3', 'https://ok.example.com');
    });
  });
});

describe('ReconScansListPage — severity rollup', () => {
  it('renders one badge per present severity with count', async () => {
    const scan = makeScan({
      id: 's-1',
      status: 'completed',
      severity_counts: { critical: 2, high: 5, medium: 1, low: 0 },
    });
    listReconScansMock.mockResolvedValue({ scans: [scan], next_cursor: null });
    renderPage('/recon?tab=completed');

    await waitFor(() => {
      expect(screen.getByTestId(`scan-row-${scan.id}`)).toBeInTheDocument();
    });

    expect(screen.getByTestId('severity-badge-critical')).toHaveTextContent('2');
    expect(screen.getByTestId('severity-badge-high')).toHaveTextContent('5');
    expect(screen.getByTestId('severity-badge-medium')).toHaveTextContent('1');
    expect(screen.queryByTestId('severity-badge-low')).not.toBeInTheDocument();
  });
});

describe('ReconScansListPage — snapshots', () => {
  it('matches the empty-state snapshot in English', async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('scans-empty')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
  });

  it('matches the empty-state snapshot in Arabic (RTL)', async () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('scans-empty')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
  });
});
