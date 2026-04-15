import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders with success status', () => {
    render(<StatusBadge status="success" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders with error status', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders with warning status', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders with info status', () => {
    render(<StatusBadge status="info" />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('renders with pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders with running status', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('displays custom label', () => {
    render(<StatusBadge status="success" label="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('applies correct aria-label with custom label', () => {
    render(<StatusBadge status="success" label="Done" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Done');
  });

  it('applies default aria-label from status', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Error');
  });

  it('renders with sm size', () => {
    render(<StatusBadge status="success" size="sm" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with lg size', () => {
    render(<StatusBadge status="success" size="lg" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusBadge status="success" className="custom-class" />);
    expect(screen.getByRole('status').className).toContain('custom-class');
  });
});
