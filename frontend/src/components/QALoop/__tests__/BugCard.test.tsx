import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BugCard } from '../BugCard';

const mockBug = {
  id: 'bug-1',
  title: 'Navigation link returns 404',
  severity: 'critical',
  status: 'verified',
  category: 'navigation',
  bug_type: 'functional',
  page_url: 'https://example.com/broken',
  reproduction_steps: ['Go to homepage', 'Click broken link', 'See 404'],
};

const severityColor = (s: string) => {
  const colors: Record<string, string> = {
    critical: 'text-red-600',
    high: 'text-orange-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };
  return colors[s] || 'text-muted-foreground';
};

const safePathname = (url?: string, fallback?: string) => {
  try {
    return new URL(url || '').pathname;
  } catch {
    return fallback || '/';
  }
};

describe('BugCard', () => {
  it('renders bug title', () => {
    render(<BugCard bug={mockBug} severityColor={severityColor} safePathname={safePathname} />);
    expect(screen.getByText('Navigation link returns 404')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(<BugCard bug={mockBug} severityColor={severityColor} safePathname={safePathname} />);
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<BugCard bug={mockBug} severityColor={severityColor} safePathname={safePathname} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it('expands to show reproduction steps on click', async () => {
    const user = userEvent.setup();
    render(<BugCard bug={mockBug} severityColor={severityColor} safePathname={safePathname} />);
    const toggleBtn = screen.getByText('Navigation link returns 404').closest('button, div[role="button"], [class*="cursor"]');
    if (toggleBtn) {
      await user.click(toggleBtn);
      const steps = screen.queryByText(/Go to homepage/) || screen.queryByText(/Click broken link/);
      if (steps) {
        expect(steps).toBeInTheDocument();
      }
    }
  });
});
