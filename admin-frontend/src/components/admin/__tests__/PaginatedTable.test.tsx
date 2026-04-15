import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PaginatedTable, Column } from '../PaginatedTable';

interface TestRow {
  id: string;
  name: string;
  email: string;
}

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'email', header: 'Email', render: (row) => row.email },
];

const testData: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com' },
];

describe('PaginatedTable', () => {
  it('renders table headers', () => {
    render(
      <PaginatedTable
        columns={columns}
        data={testData}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders table data rows', () => {
    render(
      <PaginatedTable
        columns={columns}
        data={testData}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading', () => {
    const { container } = render(
      <PaginatedTable
        columns={columns}
        data={[]}
        loading={true}
        rowKey={(r) => r.id}
        skeletonRows={3}
      />
    );
    // Skeleton elements should be present (2 columns * 3 rows = 6 skeletons minimum)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('shows empty message when data is empty and not loading', () => {
    render(
      <PaginatedTable
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('shows custom empty message', () => {
    render(
      <PaginatedTable
        columns={columns}
        data={[]}
        emptyMessage="No users yet"
        rowKey={(r) => r.id}
      />
    );
    expect(screen.getByText('No users yet')).toBeInTheDocument();
  });

  describe('pagination', () => {
    it('renders pagination buttons when hasNextPage or hasPrevPage', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          hasNextPage={true}
          hasPrevPage={false}
        />
      );
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
      expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    });

    it('disables previous page button when hasPrevPage is false', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          hasNextPage={true}
          hasPrevPage={false}
        />
      );
      expect(screen.getByLabelText('Previous page')).toBeDisabled();
    });

    it('disables next page button when hasNextPage is false', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          hasNextPage={false}
          hasPrevPage={true}
        />
      );
      expect(screen.getByLabelText('Next page')).toBeDisabled();
    });

    it('calls onNextPage when next button is clicked', async () => {
      const onNextPage = vi.fn();
      const user = userEvent.setup();
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          hasNextPage={true}
          onNextPage={onNextPage}
        />
      );

      await user.click(screen.getByLabelText('Next page'));
      expect(onNextPage).toHaveBeenCalledTimes(1);
    });

    it('calls onPrevPage when previous button is clicked', async () => {
      const onPrevPage = vi.fn();
      const user = userEvent.setup();
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          hasPrevPage={true}
          onPrevPage={onPrevPage}
        />
      );

      await user.click(screen.getByLabelText('Previous page'));
      expect(onPrevPage).toHaveBeenCalledTimes(1);
    });

    it('renders page info text', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          pageInfo="Showing 1-3 of 10"
        />
      );
      expect(screen.getByText('Showing 1-3 of 10')).toBeInTheDocument();
    });

    it('does not render pagination when no pagination props provided', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
        />
      );
      expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('renders checkboxes when selectable', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          selectable
          selectedIds={new Set()}
          onSelectionChange={() => {}}
        />
      );
      // Header checkbox + 3 row checkboxes
      expect(screen.getByLabelText('Select all')).toBeInTheDocument();
      expect(screen.getByLabelText('Select row 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Select row 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Select row 3')).toBeInTheDocument();
    });

    it('calls onSelectionChange when a row checkbox is clicked', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          selectable
          selectedIds={new Set()}
          onSelectionChange={onSelectionChange}
        />
      );

      await user.click(screen.getByLabelText('Select row 1'));
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      const passedSet = onSelectionChange.mock.calls[0][0];
      expect(passedSet.has('1')).toBe(true);
    });

    it('calls onSelectionChange to select all when header checkbox is clicked', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          selectable
          selectedIds={new Set()}
          onSelectionChange={onSelectionChange}
        />
      );

      await user.click(screen.getByLabelText('Select all'));
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      const passedSet = onSelectionChange.mock.calls[0][0];
      expect(passedSet.has('1')).toBe(true);
      expect(passedSet.has('2')).toBe(true);
      expect(passedSet.has('3')).toBe(true);
    });

    it('deselects all when header checkbox is clicked and all are selected', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
          selectable
          selectedIds={new Set(['1', '2', '3'])}
          onSelectionChange={onSelectionChange}
        />
      );

      await user.click(screen.getByLabelText('Select all'));
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      const passedSet = onSelectionChange.mock.calls[0][0];
      expect(passedSet.size).toBe(0);
    });

    it('does not render checkboxes when not selectable', () => {
      render(
        <PaginatedTable
          columns={columns}
          data={testData}
          rowKey={(r) => r.id}
        />
      );
      expect(screen.queryByLabelText('Select all')).not.toBeInTheDocument();
    });
  });
});
