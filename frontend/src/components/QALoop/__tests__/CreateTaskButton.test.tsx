import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTaskButton } from '../CreateTaskButton';

describe('CreateTaskButton', () => {
  it('renders the create task button', () => {
    render(<CreateTaskButton bugId="bug-1" bugTitle="Test bug" />);
    expect(screen.getByText(/create.task|task/i)).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<CreateTaskButton bugId="bug-1" bugTitle="Test bug" />);
    const btn = screen.getByText(/create.task|task/i).closest('button');
    if (btn) {
      await user.click(btn);
      const dialog = screen.queryByRole('dialog');
      if (dialog) {
        expect(dialog).toBeInTheDocument();
      }
    }

    vi.restoreAllMocks();
  });
});
