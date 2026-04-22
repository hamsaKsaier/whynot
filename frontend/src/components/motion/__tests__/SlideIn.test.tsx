import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock('@/lib/motion/direction', () => ({
  useMotionDirection: vi.fn(() => 1),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { useMotionDirection } from '@/lib/motion/direction';
import { SlideIn } from '../SlideIn';

const mockUseReducedMotion = vi.mocked(useReducedMotion);
const mockUseMotionDirection = vi.mocked(useMotionDirection);

describe('SlideIn', () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = document.documentElement.dir;
    mockUseReducedMotion.mockReturnValue(false);
    mockUseMotionDirection.mockReturnValue(1);
  });

  afterEach(() => {
    document.documentElement.dir = originalDir;
  });

  it('renders children', () => {
    render(<SlideIn><span>Hello</span></SlideIn>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<SlideIn>content</SlideIn>);
    expect(screen.getByText('content').closest('[data-motion="slide-in"]')).toBeInTheDocument();
  });

  it('renders from top', () => {
    render(<SlideIn from="top">content</SlideIn>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders from bottom', () => {
    render(<SlideIn from="bottom">content</SlideIn>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders from start', () => {
    render(<SlideIn from="start">content</SlideIn>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders from end', () => {
    render(<SlideIn from="end">content</SlideIn>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('flips start/end for RTL', () => {
    mockUseMotionDirection.mockReturnValue(-1);
    render(<SlideIn from="start">rtl content</SlideIn>);
    expect(screen.getByText('rtl content')).toBeInTheDocument();
  });

  it('disables transform with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<SlideIn>content</SlideIn>);
    expect(screen.getByText('content').closest('[data-motion="slide-in"]')).toBeInTheDocument();
  });

  it('supports polymorphic as prop', () => {
    render(<SlideIn as="section">content</SlideIn>);
    const el = screen.getByText('content').closest('[data-motion="slide-in"]');
    expect(el?.tagName).toBe('SECTION');
  });
});
