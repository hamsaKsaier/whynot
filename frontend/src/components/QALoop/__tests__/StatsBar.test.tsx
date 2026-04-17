import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from '../StatsBar';

const defaultProps = {
  activeSession: {
    id: 'session-1',
    target_url: 'https://example.com',
    status: 'running',
    quality_threshold: 80,
    max_iterations: 10,
    current_iteration: 3,
    created_at: '2024-01-01T00:00:00Z',
  },
  pagesExplored: ['page1', 'page2'],
  testsGenerated: ['test1', 'test2', 'test3'],
  bugsFound: [
    { title: 'Bug 1', severity: 'critical' },
    { title: 'Bug 2', severity: 'medium' },
  ],
  chaosResults: [],
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
  iterationHistory: [],
  iteration: 3,
  qualityThreshold: 80,
  showQualityDashboard: false,
  onToggleQualityDashboard: vi.fn(),
};

describe('StatsBar', () => {
  it('renders page count', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('renders test count', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders bug count', () => {
    render(<StatsBar {...defaultProps} />);
    const bugCounts = screen.getAllByText('2');
    expect(bugCounts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders quality score', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getByText(/pages/i)).toBeInTheDocument();
    expect(screen.getByText(/tests/i)).toBeInTheDocument();
    expect(screen.getByText(/bugs/i)).toBeInTheDocument();
  });
});
