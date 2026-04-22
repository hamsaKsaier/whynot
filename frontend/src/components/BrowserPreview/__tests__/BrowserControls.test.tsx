import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserControls } from '../BrowserControls';

describe('BrowserControls', () => {
  it('renders URL in the address bar', () => {
    render(<BrowserControls url="https://example.com" />);
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('shows about:blank when no URL', () => {
    render(<BrowserControls />);
    expect(screen.getByText('about:blank')).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<BrowserControls />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('calls onNavigate with correct direction on back click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BrowserControls onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onNavigate).toHaveBeenCalledWith('back');
  });

  it('calls onNavigate with correct direction on forward click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BrowserControls onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /forward/i }));
    expect(onNavigate).toHaveBeenCalledWith('forward');
  });

  it('calls onNavigate with correct direction on refresh click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BrowserControls onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onNavigate).toHaveBeenCalledWith('refresh');
  });

  it('calls onNavigate with correct direction on home click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<BrowserControls onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /home/i }));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('displays current zoom level', () => {
    render(<BrowserControls currentZoom={150} />);
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('calls onZoomChange on zoom out click', async () => {
    const user = userEvent.setup();
    const onZoomChange = vi.fn();
    render(<BrowserControls currentZoom={100} onZoomChange={onZoomChange} />);
    await user.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(onZoomChange).toHaveBeenCalledWith(75);
  });

  it('calls onZoomChange on zoom in click', async () => {
    const user = userEvent.setup();
    const onZoomChange = vi.fn();
    render(<BrowserControls currentZoom={100} onZoomChange={onZoomChange} />);
    await user.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(onZoomChange).toHaveBeenCalledWith(125);
  });

  it('does not zoom below 25', async () => {
    const user = userEvent.setup();
    const onZoomChange = vi.fn();
    render(<BrowserControls currentZoom={25} onZoomChange={onZoomChange} />);
    await user.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(onZoomChange).toHaveBeenCalledWith(25);
  });

  it('does not zoom above 200', async () => {
    const user = userEvent.setup();
    const onZoomChange = vi.fn();
    render(<BrowserControls currentZoom={200} onZoomChange={onZoomChange} />);
    await user.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(onZoomChange).toHaveBeenCalledWith(200);
  });

  it('toggles advanced settings panel', async () => {
    const user = userEvent.setup();
    render(<BrowserControls />);
    expect(screen.queryByText('Location:')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /advanced/i }));
    expect(screen.getByText('Location:')).toBeInTheDocument();
  });

  it('shows secure badge when URL is provided', () => {
    render(<BrowserControls url="https://example.com" />);
    expect(screen.getByText('Secure')).toBeInTheDocument();
  });
});
