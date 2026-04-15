import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestResultsView } from '../TestResultsView';

const mockTestCase = {
  id: 'tc-1',
  name: 'Login Flow Test',
  description: 'Tests the login flow',
  steps: [
    {
      id: 'step-1',
      action: 'NAVIGATE' as const,
      target: { text: 'Login Page' },
      value: 'https://example.com/login',
      description: 'Navigate to login page',
    },
    {
      id: 'step-2',
      action: 'FILL' as const,
      target: { text: 'Email Input' },
      value: 'test@example.com',
      description: 'Fill email',
    },
  ],
  website_url: 'https://example.com',
  scenario_type: 'positive' as const,
  risk_level: 'medium' as const,
  priority_score: 75,
};

const mockExecutionResult = {
  execution_id: 'exec-1',
  test_case_id: 'tc-1',
  status: 'completed' as const,
  steps: [
    {
      step_id: 'step-1',
      success: true,
      execution_time_ms: 500,
      element_found: true,
    },
    {
      step_id: 'step-2',
      success: false,
      error: 'Element not found',
      execution_time_ms: 1200,
      element_found: false,
    },
  ],
  total_duration_ms: 1700,
  screenshots: [],
  started_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T00:00:01.7Z',
};

describe('TestResultsView', () => {
  it('renders without crashing with null props', () => {
    render(
      <TestResultsView
        testCase={null}
        executionResult={null}
        onViewScreenshots={vi.fn()}
      />
    );
    expect(document.body).toBeInTheDocument();
  });

  it('renders test case name', () => {
    render(
      <TestResultsView
        testCase={mockTestCase}
        executionResult={mockExecutionResult}
        onViewScreenshots={vi.fn()}
      />
    );
    expect(screen.getByText('Login Flow Test')).toBeInTheDocument();
  });

  it('renders step results', () => {
    render(
      <TestResultsView
        testCase={mockTestCase}
        executionResult={mockExecutionResult}
        onViewScreenshots={vi.fn()}
      />
    );
    expect(screen.getByText(/Navigate to login page/)).toBeInTheDocument();
    expect(screen.getByText(/Fill email/)).toBeInTheDocument();
  });

  it('shows pass/fail indicators for steps', () => {
    render(
      <TestResultsView
        testCase={mockTestCase}
        executionResult={mockExecutionResult}
        onViewScreenshots={vi.fn()}
      />
    );
    expect(screen.getByText(/Element not found/)).toBeInTheDocument();
  });

  it('displays duration', () => {
    render(
      <TestResultsView
        testCase={mockTestCase}
        executionResult={mockExecutionResult}
        onViewScreenshots={vi.fn()}
      />
    );
    expect(screen.getByText(/1700|1\.7/)).toBeInTheDocument();
  });
});
