import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportTab } from '../ReportTab';

const mockReport = {
  summary: 'Scan complete with findings',
  quality_score: 82,
  findings_by_agent: {
    exploratory: { description: 'Found 3 broken links and slow pages', pages: 5, bugs: 3 },
    security: { description: 'No CSRF tokens found on forms' },
    api: { description: 'API returns 500 on invalid input' },
    auto_tester: { description: '2 test cases failing consistently' },
  },
  critical_clusters: [
    {
      page: '/dashboard',
      issues: ['Slow load', 'Missing CSRF'],
      priority: 'high',
      recommendation: 'Optimize dashboard load time',
    },
  ],
  recommendations: [
    'Add CSRF protection to all forms',
    'Optimize dashboard load time',
    'Fix broken navigation links',
  ],
};

describe('ReportTab', () => {
  it('renders without crashing with null report', () => {
    render(<ReportTab report={null} />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders quality score', () => {
    render(<ReportTab report={mockReport} />);
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it('renders recommendations', () => {
    render(<ReportTab report={mockReport} />);
    expect(screen.getByText(/Add CSRF protection/)).toBeInTheDocument();
  });

  it('renders findings sections', () => {
    render(<ReportTab report={mockReport} />);
    // Accordion header renders agent labels; verify at least one finding section appears
    expect(
      screen.queryByText(/security/i) ||
        screen.queryByText(/exploratory/i) ||
        screen.queryByText(/findings/i),
    ).toBeTruthy();
  });
});
