import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders a single skeleton by default', () => {
    const { container } = render(<SkeletonLoader />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(1);
  });

  it('renders multiple skeletons when count is specified', () => {
    const { container } = render(<SkeletonLoader count={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('applies default width and height', () => {
    const { container } = render(<SkeletonLoader />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton?.className).toContain('w-full');
    expect(skeleton?.className).toContain('h-4');
  });

  it('applies custom width and height', () => {
    const { container } = render(<SkeletonLoader width="w-32" height="h-8" />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton?.className).toContain('w-32');
    expect(skeleton?.className).toContain('h-8');
  });

  it('renders circle shape when circle prop is true', () => {
    const { container } = render(<SkeletonLoader circle />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton?.className).toContain('rounded-full');
  });

  it('renders rounded shape by default', () => {
    const { container } = render(<SkeletonLoader />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton?.className).toContain('rounded');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonLoader className="my-skeleton" />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton?.className).toContain('my-skeleton');
  });
});
