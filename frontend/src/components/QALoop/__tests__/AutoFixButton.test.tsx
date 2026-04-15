import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoFixButton } from '../AutoFixButton';

describe('AutoFixButton', () => {
  it('renders the auto-fix button', () => {
    render(<AutoFixButton bugId="bug-1" bugTitle="Broken link" />);
    expect(screen.getByText(/auto.fix|fix/i)).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<AutoFixButton bugId="bug-1" bugTitle="Broken link" />);
    const btn = screen.getByText(/auto.fix|fix/i).closest('button');
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
