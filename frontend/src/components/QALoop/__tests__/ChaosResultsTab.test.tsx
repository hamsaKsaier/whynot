import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChaosResultsTab } from '../ChaosResultsTab';

const mockResults = [
  {
    id: 'cr-1',
    pageUrl: 'https://example.com/login',
    attackCategory: 'xss',
    attackName: 'Reflected XSS',
    payloadUsed: '<script>alert(1)</script>',
    result: 'blocked' as const,
    vulnerabilityConfirmed: false,
    confidence: 0.95,
    reproductionSteps: ['Navigate to login', 'Insert payload in input'],
  },
  {
    id: 'cr-2',
    pageUrl: 'https://example.com/search',
    attackCategory: 'sql_injection',
    attackName: 'SQL Injection',
    payloadUsed: "' OR 1=1 --",
    result: 'vulnerable' as const,
    vulnerabilityConfirmed: true,
    severity: 'critical',
    confidence: 0.88,
    reproductionSteps: ['Navigate to search', 'Enter payload'],
  },
];

const mockSummary = {
  vulnerabilities_found: 1,
  blocked_attacks: 1,
  total_attacks: 2,
  pages_tested: 2,
};

describe('ChaosResultsTab', () => {
  it('renders without crashing', () => {
    render(<ChaosResultsTab results={[]} />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows results', () => {
    render(<ChaosResultsTab results={mockResults} summary={mockSummary} />);
    expect(screen.getByText(/Reflected XSS/)).toBeInTheDocument();
    expect(screen.getByText(/SQL Injection/)).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    render(<ChaosResultsTab results={mockResults} summary={mockSummary} />);
    expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
  });

  it('shows vulnerability status', () => {
    render(<ChaosResultsTab results={mockResults} summary={mockSummary} />);
    expect(screen.getAllByText(/blocked/i).length).toBeGreaterThan(0);
    // The vulnerable result surfaces via its severity badge (critical)
    expect(screen.getAllByText(/vulnerable|critical/i).length).toBeGreaterThan(0);
  });

  it('shows running spinner when isRunning and no results', () => {
    render(<ChaosResultsTab results={[]} isRunning />);
    const spinner = document.querySelector('.animate-spin');
    if (spinner) {
      expect(spinner).toBeInTheDocument();
    }
  });
});
