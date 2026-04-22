import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPageHeader } from '../AdminPageHeader';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AdminPageHeader', () => {
  it('renders title', () => {
    renderWithRouter(<AdminPageHeader title="Users" />);
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders title as h1', () => {
    renderWithRouter(<AdminPageHeader title="Dashboard" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Dashboard');
  });

  it('renders description when provided', () => {
    renderWithRouter(
      <AdminPageHeader title="Users" description="Manage all users" />
    );
    expect(screen.getByText('Manage all users')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    renderWithRouter(<AdminPageHeader title="Users" />);
    expect(screen.queryByText('Manage all users')).not.toBeInTheDocument();
  });

  it('renders breadcrumbs with links', () => {
    renderWithRouter(
      <AdminPageHeader
        title="User Details"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Users', to: '/users' },
          { label: 'User Details' },
        ]}
      />
    );
    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveAttribute('href', '/');

    const usersLink = screen.getByRole('link', { name: 'Users' });
    expect(usersLink).toHaveAttribute('href', '/users');

    // Last breadcrumb has no link (title h1 also renders "User Details")
    expect(screen.getAllByText('User Details').length).toBeGreaterThanOrEqual(1);
    const allLinks = screen.getAllByRole('link');
    expect(allLinks).toHaveLength(2);
  });

  it('does not render breadcrumbs nav when not provided', () => {
    renderWithRouter(<AdminPageHeader title="Users" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('does not render breadcrumbs nav when array is empty', () => {
    renderWithRouter(<AdminPageHeader title="Users" breadcrumbs={[]} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders actions slot', () => {
    renderWithRouter(
      <AdminPageHeader
        title="Users"
        actions={<button>Add User</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
  });

  it('does not render actions container when actions not provided', () => {
    const { container } = renderWithRouter(<AdminPageHeader title="Users" />);
    const actionsDiv = container.querySelector('.flex-shrink-0');
    expect(actionsDiv).not.toBeInTheDocument();
  });
});
