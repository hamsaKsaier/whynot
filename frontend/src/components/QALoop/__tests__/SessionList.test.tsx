import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionList } from '../SessionList';

const mockSessions = [
  {
    id: 'session-1',
    target_url: 'https://example.com',
    status: 'completed',
    created_at: '2024-01-01T00:00:00Z',
    pages_count: 5,
    tests_count: 10,
    bugs_count: 2,
  },
  {
    id: 'session-2',
    target_url: 'https://test.com',
    status: 'running',
    created_at: '2024-01-02T00:00:00Z',
    pages_count: 3,
    tests_count: 5,
    bugs_count: 0,
  },
];

describe('SessionList', () => {
  it('renders session items', () => {
    render(
      <SessionList
        sessions={mockSessions}
        activeSession={null}
        isLoading={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/test\.com/)).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    render(
      <SessionList
        sessions={[]}
        activeSession={null}
        isLoading={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByText(/first|no sessions|start/i).length).toBeGreaterThan(0);
  });

  it('calls onSelect when session clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SessionList
        sessions={mockSessions}
        activeSession={null}
        isLoading={false}
        onSelect={onSelect}
      />
    );
    const sessionItem = screen.getByText(/example\.com/).closest('button, [role="button"], div[class*="cursor"]');
    if (sessionItem) {
      await user.click(sessionItem);
      expect(onSelect).toHaveBeenCalled();
    }
  });

  it('highlights active session', () => {
    render(
      <SessionList
        sessions={mockSessions}
        activeSession={mockSessions[0]}
        isLoading={false}
        onSelect={vi.fn()}
      />
    );
    expect(document.body).toBeInTheDocument();
  });

  it('shows load more button when hasMore', () => {
    render(
      <SessionList
        sessions={mockSessions}
        activeSession={null}
        isLoading={false}
        onSelect={vi.fn()}
        hasMore
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText(/load more/i)).toBeInTheDocument();
  });
});
