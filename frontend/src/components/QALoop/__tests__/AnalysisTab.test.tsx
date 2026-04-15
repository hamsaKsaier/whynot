import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisTab } from '../AnalysisTab';

const mockAnalyses = [
  {
    id: 'a-1',
    failureId: 'f-1',
    testCaseId: 'tc-1',
    testCaseName: 'Login Test',
    category: 'bug' as const,
    confidence: 0.85,
    rootCause: 'Missing form validation',
    hypothesis: 'Server-side validation not matching client rules',
    minimalSteps: ['Open login page', 'Submit empty form'],
    environmentFactors: ['Production database'],
    fixSuggestion: 'Add client-side validation',
    verified: true,
  },
];

const mockCorrelations = [
  {
    id: 'c-1',
    failureIds: ['f-1', 'f-2'],
    pattern: 'Both failures on login page',
    confidence: 0.9,
    commonFactors: ['Same page', 'Form submission'],
  },
];

describe('AnalysisTab', () => {
  it('renders without crashing', () => {
    render(<AnalysisTab analyses={[]} correlations={[]} />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows analysis items', () => {
    render(<AnalysisTab analyses={mockAnalyses} correlations={mockCorrelations} />);
    expect(screen.getByText('Login Test')).toBeInTheDocument();
  });

  it('shows category badge', () => {
    render(<AnalysisTab analyses={mockAnalyses} correlations={mockCorrelations} />);
    expect(screen.getByText(/bug/i)).toBeInTheDocument();
  });

  it('shows root cause text', () => {
    render(<AnalysisTab analyses={mockAnalyses} correlations={mockCorrelations} />);
    expect(screen.getByText(/Missing form validation/)).toBeInTheDocument();
  });

  it('shows confidence score', () => {
    render(<AnalysisTab analyses={mockAnalyses} correlations={mockCorrelations} />);
    expect(screen.getByText(/85%|0\.85/)).toBeInTheDocument();
  });
});
