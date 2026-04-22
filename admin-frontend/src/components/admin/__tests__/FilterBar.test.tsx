import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('renders search input when onSearchChange is provided', () => {
    render(<FilterBar search="" onSearchChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders custom search placeholder', () => {
    render(
      <FilterBar
        search=""
        onSearchChange={() => {}}
        searchPlaceholder="Search users..."
      />
    );
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  it('does not render search input when onSearchChange is not provided', () => {
    render(<FilterBar />);
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('calls onSearchChange when user types in search', async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar search="" onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Search...');
    await user.type(input, 'test');

    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenLastCalledWith('t');
  });

  it('displays the current search value', () => {
    render(<FilterBar search="hello" onSearchChange={() => {}} />);
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('renders filter selects', () => {
    const filters = [
      {
        key: 'status',
        label: 'Status',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
        value: '__all__',
        onChange: vi.fn(),
      },
    ];

    render(<FilterBar filters={filters} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders active filter chips', () => {
    const onRemove = vi.fn();
    render(
      <FilterBar
        activeFilters={[
          { key: 'status', label: 'Status: Active', onRemove },
        ]}
      />
    );
    expect(screen.getByText('Status: Active')).toBeInTheDocument();
  });

  it('calls onRemove when active filter chip remove button is clicked', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterBar
        activeFilters={[
          { key: 'status', label: 'Status: Active', onRemove },
        ]}
      />
    );

    const removeButton = screen.getByRole('button');
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not render active filters section when empty', () => {
    const { container } = render(<FilterBar activeFilters={[]} />);
    const badges = container.querySelectorAll('[data-slot="badge"]');
    expect(badges).toHaveLength(0);
  });

  it('renders children', () => {
    render(
      <FilterBar>
        <button>Extra Action</button>
      </FilterBar>
    );
    expect(screen.getByRole('button', { name: 'Extra Action' })).toBeInTheDocument();
  });
});
