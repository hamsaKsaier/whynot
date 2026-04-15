import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ExportMenu } from '../ExportMenu';

describe('ExportMenu', () => {
  it('renders the export button', () => {
    render(<ExportMenu onExportCSV={() => {}} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('renders the export button as disabled when disabled prop is true', () => {
    render(<ExportMenu onExportCSV={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
  });

  it('shows CSV option in dropdown when onExportCSV is provided', async () => {
    const user = userEvent.setup();
    render(<ExportMenu onExportCSV={() => {}} />);

    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
  });

  it('shows JSON option in dropdown when onExportJSON is provided', async () => {
    const user = userEvent.setup();
    render(<ExportMenu onExportJSON={() => {}} />);

    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText('Export as JSON')).toBeInTheDocument();
  });

  it('shows both options when both handlers are provided', async () => {
    const user = userEvent.setup();
    render(<ExportMenu onExportCSV={() => {}} onExportJSON={() => {}} />);

    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as JSON')).toBeInTheDocument();
  });

  it('calls onExportCSV when CSV option is clicked', async () => {
    const onExportCSV = vi.fn();
    const user = userEvent.setup();
    render(<ExportMenu onExportCSV={onExportCSV} />);

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('Export as CSV'));
    expect(onExportCSV).toHaveBeenCalledTimes(1);
  });

  it('calls onExportJSON when JSON option is clicked', async () => {
    const onExportJSON = vi.fn();
    const user = userEvent.setup();
    render(<ExportMenu onExportJSON={onExportJSON} />);

    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('Export as JSON'));
    expect(onExportJSON).toHaveBeenCalledTimes(1);
  });
});
