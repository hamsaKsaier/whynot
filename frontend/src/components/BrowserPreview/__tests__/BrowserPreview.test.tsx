import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserPreview } from '../BrowserPreview';

describe('BrowserPreview', () => {
  it('renders Card wrapper', () => {
    const { container } = render(<BrowserPreview />);
    expect(container.querySelector('.rounded-lg.border')).toBeInTheDocument();
  });

  it('renders idle state when no image', () => {
    render(<BrowserPreview />);
    expect(screen.getByText('Waiting for browser frames...')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<BrowserPreview isLoading />);
    expect(screen.getByText('Connecting to browser stream...')).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    render(<BrowserPreview imageUrl="data:image/png;base64,abc" />);
    expect(screen.getByAltText('Browser preview')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<BrowserPreview error="Connection lost" />);
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
  });

  it('shows status badge - Idle', () => {
    render(<BrowserPreview />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows status badge - Streaming when loading', () => {
    render(<BrowserPreview isLoading />);
    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });

  it('shows status badge - Error', () => {
    render(<BrowserPreview error="fail" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows status badge - Connected when image present', () => {
    render(<BrowserPreview imageUrl="data:image/png;base64,x" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows resolution and browser in footer', () => {
    render(<BrowserPreview />);
    expect(screen.getByText(/1920x1080/)).toBeInTheDocument();
    expect(screen.getByText(/Chrome/)).toBeInTheDocument();
  });

  it('does not render FrameNavigation without frameHistory', () => {
    render(<BrowserPreview />);
    expect(screen.queryByText(/Frame \d+ of/)).not.toBeInTheDocument();
  });

  it('renders FrameNavigation when frameHistory provided', () => {
    const frameHistory = new Map<number, Array<{ imageUrl: string; timestamp: number }>>([
      [0, [{ imageUrl: 'data:image/png;base64,a', timestamp: Date.now() }]],
    ]);
    render(
      <BrowserPreview
        frameHistory={frameHistory}
        currentStepIndex={0}
        currentFrameIndex={0}
        onGoToStep={vi.fn()}
        onGoToNextFrame={vi.fn()}
        onGoToPrevFrame={vi.fn()}
        onGoToFirstFrame={vi.fn()}
        onGoToLastFrame={vi.fn()}
        getTotalFrames={() => 1}
        getCurrentFramePosition={() => ({ step: 1, frame: 1, total: 1 })}
      />
    );
    expect(screen.getByText(/Frame 1 of 1/)).toBeInTheDocument();
  });

  it('renders BrowserControls with URL', () => {
    render(<BrowserPreview url="https://test.com" />);
    expect(screen.getByText('https://test.com')).toBeInTheDocument();
  });
});
