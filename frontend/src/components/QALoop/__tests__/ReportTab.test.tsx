import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportTab } from '../ReportTab';

const mockReport = {
  qualityScore: 82,
  findings: {
    exploratory: ['Found 3 broken links', 'Page load over 5s on /dashboard'],
    security: ['No CSRF tokens found on forms'],
    api: ['API returns 500 on invalid input'],
    autoTester: ['2 test cases failing consistently'],
  },
  criticalClusters: [
    {
      page: '/dashboard',
      issues: ['Slow load', 'Missing CSRF'],
      priority: 'high',
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
    expect(screen.getByText(/broken links/i)).toBeInTheDocument();
  });
});
