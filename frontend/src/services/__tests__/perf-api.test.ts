import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../api';
import { startPerfRun, stopPerfRun, getPerfRuns, getPerfRun, getPerfPresets } from '../perf-api';

describe('Performance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('startPerfRun posts run config', async () => {
    const config = {
      testType: 'load' as const,
      targetUrl: 'https://example.com',
      method: 'GET',
    };
    const response = { success: true, runId: 'run-1', testType: 'load', targetUrl: 'https://example.com', preset: 'default', wsPath: '/ws' };
    (apiClient.post as any).mockResolvedValueOnce({ data: response });

    const result = await startPerfRun(config);
    expect(apiClient.post).toHaveBeenCalledWith('/perf/run', config);
    expect(result).toEqual(response);
  });

  it('stopPerfRun stops a run', async () => {
    const response = { success: true, message: 'Stopped' };
    (apiClient.post as any).mockResolvedValueOnce({ data: response });

    const result = await stopPerfRun('run-1');
    expect(apiClient.post).toHaveBeenCalledWith('/perf/stop/run-1');
    expect(result).toEqual(response);
  });

  it('getPerfRuns fetches runs with options', async () => {
    const response = { runs: [], total: 0 };
    (apiClient.get as any).mockResolvedValueOnce({ data: response });

    const result = await getPerfRuns({ projectId: 'proj-1', limit: 10, offset: 5 });
    expect(apiClient.get).toHaveBeenCalledWith('/perf/runs', {
      params: { projectId: 'proj-1', limit: 10, offset: 5 },
    });
    expect(result).toEqual(response);
  });

  it('getPerfRuns fetches runs without options', async () => {
    const response = { runs: [], total: 0 };
    (apiClient.get as any).mockResolvedValueOnce({ data: response });

    const result = await getPerfRuns();
    expect(apiClient.get).toHaveBeenCalledWith('/perf/runs', { params: {} });
    expect(result).toEqual(response);
  });

  it('getPerfRun fetches a single run', async () => {
    const response = { run: { id: 'run-1', status: 'completed' } };
    (apiClient.get as any).mockResolvedValueOnce({ data: response });

    const result = await getPerfRun('run-1');
    expect(apiClient.get).toHaveBeenCalledWith('/perf/runs/run-1');
    expect(result).toEqual(response);
  });

  it('getPerfPresets fetches presets', async () => {
    const response = { presets: { smoke: {}, load: {} } };
    (apiClient.get as any).mockResolvedValueOnce({ data: response });

    const result = await getPerfPresets();
    expect(apiClient.get).toHaveBeenCalledWith('/perf/presets');
    expect(result).toEqual(response);
  });
});
