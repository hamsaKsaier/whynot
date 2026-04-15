import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Breadcrumbs } from '../Breadcrumbs';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Breadcrumbs', () => {
  it('renders home link', () => {
    renderWithRouter(
      <Breadcrumbs items={[{ label: 'Projects' }]} />
    );
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
  });

  it('renders breadcrumb items', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'Projects', path: '/projects' },
          { label: 'My Project' },
        ]}
      />
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders last item as current page', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'Projects', path: '/projects' },
          { label: 'Current Page' },
        ]}
      />
    );

    const currentPage = screen.getByText('Current Page');
    expect(currentPage.closest('[aria-current="page"]')).toBeInTheDocument();
  });

  it('renders middle items as links when path is provided', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'Projects', path: '/projects' },
          { label: 'Current Page' },
        ]}
      />
    );

    const link = screen.getByText('Projects').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('has breadcrumb navigation aria-label', () => {
    renderWithRouter(
      <Breadcrumbs items={[{ label: 'Page' }]} />
    );

    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });

  it('renders item icons when provided', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'Page', icon: <span data-testid="item-icon">icon</span> },
        ]}
      />
    );

    expect(screen.getByTestId('item-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithRouter(
      <Breadcrumbs items={[{ label: 'Page' }]} className="my-breadcrumbs" />
    );

    expect(container.querySelector('.my-breadcrumbs')).toBeInTheDocument();
  });
});
