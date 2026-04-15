import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from '../popover';

describe('Popover', () => {
  it('renders trigger', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );
    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('shows content on click', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Content here</PopoverContent>
      </Popover>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('does not show content when closed', () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Hidden</PopoverContent>
      </Popover>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
