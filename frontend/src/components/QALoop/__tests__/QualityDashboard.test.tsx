import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QualityDashboard } from '../QualityDashboard';

const defaultProps = {
  qualityScore: {
    overall: 75,
    breakdown: {
      coverage: 80,
      stability: 70,
      security: 75,
      accessibility: 60,
      performance: 90,
    },
    trend: 'improving' as const,
    scoreDelta: 5,
  },
  risks: { critical: 1, high: 2, medium: 3, low: 5 },
  iterationHistory: [
    { iteration: 1, score: 50, focus: 'initial', timestamp: '2024-01-01T00:00:00Z' },
    { iteration: 2, score: 65, focus: 'security', timestamp: '2024-01-01T01:00:00Z' },
    { iteration: 3, score: 75, focus: 'coverage', timestamp: '2024-01-01T02:00:00Z' },
  ],
  currentIteration: 3,
  targetThreshold: 80,
};

describe('QualityDashboard', () => {
  it('renders overall score', () => {
    render(<QualityDashboard {...defaultProps} />);
    expect(screen.getAllByText(/75/).length).toBeGreaterThan(0);
  });

  it('renders score breakdown metrics', () => {
    render(<QualityDashboard {...defaultProps} />);
    expect(screen.getAllByText(/coverage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/stability/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
  });

  it('renders risk counts', () => {
    render(<QualityDashboard {...defaultProps} />);
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it('renders trend indicator', () => {
    render(<QualityDashboard {...defaultProps} />);
    expect(screen.getByText(/improving|↑|\+5/i)).toBeInTheDocument();
  });

  it('renders cost tracking when provided', () => {
    render(
      <QualityDashboard
        {...defaultProps}
        costTracking={{
          totalCostCents: 250,
          alertLevel: 'info',
          alertPercentage: 25,
          budgetExceeded: false,
        }}
      />
    );
    expect(screen.getByText(/\$2\.50|250|cost/i)).toBeInTheDocument();
  });

  it('renders iteration timeline', () => {
    render(<QualityDashboard {...defaultProps} />);
    expect(screen.getAllByText(/iteration|history/i).length).toBeGreaterThan(0);
  });
});
