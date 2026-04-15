import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FrameNavigation } from '../FrameNavigation';

const defaultProps = {
  currentStepIndex: 0,
  currentFrameIndex: 0,
  frameHistory: new Map<number, Array<{ imageUrl: string; timestamp: number }>>([
    [0, [
      { imageUrl: 'frame1.png', timestamp: 1000 },
      { imageUrl: 'frame2.png', timestamp: 2000 },
    ]],
    [1, [
      { imageUrl: 'frame3.png', timestamp: 3000 },
    ]],
  ]),
  totalFrames: 3,
  framePosition: { step: 1, frame: 1, total: 3 },
  onGoToStep: vi.fn(),
  onGoToNextFrame: vi.fn(),
  onGoToPrevFrame: vi.fn(),
  onGoToFirstFrame: vi.fn(),
  onGoToLastFrame: vi.fn(),
};

describe('FrameNavigation', () => {
  it('renders frame counter', () => {
    render(<FrameNavigation {...defaultProps} />);
    expect(screen.getByText(/Frame 1 of 3/)).toBeInTheDocument();
  });

  it('renders step info in frame counter', () => {
    render(<FrameNavigation {...defaultProps} />);
    expect(screen.getByText(/Step 1, Frame 1/)).toBeInTheDocument();
  });

  it('shows "No frames" when total is 0', () => {
    render(
      <FrameNavigation
        {...defaultProps}
        frameHistory={new Map()}
        totalFrames={0}
        framePosition={{ step: 0, frame: 0, total: 0 }}
      />
    );
    expect(screen.getByText('No frames')).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<FrameNavigation {...defaultProps} />);
    expect(screen.getByRole('button', { name: /first frame/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous frame/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next frame/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last frame/i })).toBeInTheDocument();
  });

  it('disables prev/first buttons on first frame of first step', () => {
    render(<FrameNavigation {...defaultProps} currentStepIndex={0} currentFrameIndex={0} />);
    expect(screen.getByRole('button', { name: /first frame/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous frame/i })).toBeDisabled();
  });

  it('enables next/last buttons when more frames exist', () => {
    render(<FrameNavigation {...defaultProps} currentStepIndex={0} currentFrameIndex={0} />);
    expect(screen.getByRole('button', { name: /next frame/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /last frame/i })).not.toBeDisabled();
  });

  it('calls onGoToNextFrame on next click', async () => {
    const user = userEvent.setup();
    const onGoToNextFrame = vi.fn();
    render(<FrameNavigation {...defaultProps} onGoToNextFrame={onGoToNextFrame} />);
    await user.click(screen.getByRole('button', { name: /next frame/i }));
    expect(onGoToNextFrame).toHaveBeenCalledOnce();
  });

  it('calls onGoToPrevFrame on prev click', async () => {
    const user = userEvent.setup();
    const onGoToPrevFrame = vi.fn();
    render(
      <FrameNavigation
        {...defaultProps}
        currentStepIndex={0}
        currentFrameIndex={1}
        onGoToPrevFrame={onGoToPrevFrame}
      />
    );
    await user.click(screen.getByRole('button', { name: /previous frame/i }));
    expect(onGoToPrevFrame).toHaveBeenCalledOnce();
  });

  it('calls onGoToFirstFrame on first click', async () => {
    const user = userEvent.setup();
    const onGoToFirstFrame = vi.fn();
    render(
      <FrameNavigation
        {...defaultProps}
        currentStepIndex={1}
        currentFrameIndex={0}
        onGoToFirstFrame={onGoToFirstFrame}
      />
    );
    await user.click(screen.getByRole('button', { name: /first frame/i }));
    expect(onGoToFirstFrame).toHaveBeenCalledOnce();
  });

  it('calls onGoToLastFrame on last click', async () => {
    const user = userEvent.setup();
    const onGoToLastFrame = vi.fn();
    render(<FrameNavigation {...defaultProps} onGoToLastFrame={onGoToLastFrame} />);
    await user.click(screen.getByRole('button', { name: /last frame/i }));
    expect(onGoToLastFrame).toHaveBeenCalledOnce();
  });

  it('renders slider when totalFrames > 0', () => {
    const { container } = render(<FrameNavigation {...defaultProps} />);
    expect(container.querySelector('[role="slider"]')).toBeInTheDocument();
  });

  it('does not render slider when totalFrames is 0', () => {
    const { container } = render(
      <FrameNavigation
        {...defaultProps}
        totalFrames={0}
        frameHistory={new Map()}
        framePosition={{ step: 0, frame: 0, total: 0 }}
      />
    );
    expect(container.querySelector('[role="slider"]')).not.toBeInTheDocument();
  });
});
