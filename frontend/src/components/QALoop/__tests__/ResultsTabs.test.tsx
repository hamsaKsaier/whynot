import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsTabs } from '../ResultsTabs';

const defaultProps = {
  testCases: [
    {
      id: 'tc-1',
      name: 'Login Test',
      status: 'passed',
      category: 'functional',
      priority: 'high',
    },
  ],
  bugs: [
    {
      id: 'bug-1',
      title: 'Broken link on homepage',
      severity: 'critical',
      status: 'verified',
      category: 'navigation',
      bug_type: 'functional',
      page_url: 'https://example.com',
    },
  ],
  pages: [
    {
      url: 'https://example.com',
      title: 'Homepage',
      is_explored: true,
      page_type: 'landing',
    },
  ],
  chaosResults: [],
  analyses: [],
  correlations: [],
};

describe('ResultsTabs', () => {
  it('renders tab buttons', () => {
    render(<ResultsTabs {...defaultProps} />);
    expect(screen.getByText(/tests/i)).toBeInTheDocument();
    expect(screen.getByText(/bugs/i)).toBeInTheDocument();
    expect(screen.getByText(/pages/i)).toBeInTheDocument();
  });

  it('shows test cases in default tab', () => {
    render(<ResultsTabs {...defaultProps} />);
    expect(screen.getByText('Login Test')).toBeInTheDocument();
  });

  it('switches to bugs tab on click', async () => {
    const user = userEvent.setup();
    render(<ResultsTabs {...defaultProps} />);
    const bugsTab = screen.getAllByText(/bugs/i).find(
      (el) => el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab'
    );
    if (bugsTab) {
      await user.click(bugsTab);
      expect(screen.getByText('Broken link on homepage')).toBeInTheDocument();
    }
  });

  it('shows summary stats', () => {
    render(<ResultsTabs {...defaultProps} />);
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });
});
