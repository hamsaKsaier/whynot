import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentProgressPanel } from '../AgentProgressPanel';

const mockAgents = [
  {
    agent_type: 'qa_lead',
    status: 'working',
    current_task: 'Coordinating agents',
    progress_pct: 45,
    discoveries: [],
    pages_explored: 5,
    tests_generated: 3,
    bugs_found: 1,
    api_endpoints_tested: 0,
  },
  {
    agent_type: 'exploratory',
    status: 'done',
    current_task: null,
    progress_pct: 100,
    discoveries: [],
    pages_explored: 12,
    tests_generated: 8,
    bugs_found: 3,
    api_endpoints_tested: 0,
  },
];

const mockGet = vi.fn();

vi.mock('../../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('AgentProgressPanel', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ data: { agents: mockAgents } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockGet.mockReset();
  });

  it('renders without crashing', () => {
    render(<AgentProgressPanel sessionId="session-1" isRunning={false} />);
    expect(document.body).toBeInTheDocument();
  });

  it('fetches and displays agents when running', async () => {
    render(<AgentProgressPanel sessionId="session-1" isRunning />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
  });

  it('shows agent types', async () => {
    render(<AgentProgressPanel sessionId="session-1" isRunning />);
    await waitFor(() => {
      expect(screen.getByText(/qa.lead|QA Lead/i)).toBeInTheDocument();
    });
  });
});
