import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

let mockFlagValue = false;
vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => mockFlagValue,
}));

import { Feature } from '../Feature';

describe('Feature', () => {
  it('renders children when feature flag is enabled', () => {
    mockFlagValue = true;
    render(
      <Feature flag="test_feature">
        <div>Feature content</div>
      </Feature>
    );

    expect(screen.getByText('Feature content')).toBeInTheDocument();
  });

  it('does not render children when feature flag is disabled', () => {
    mockFlagValue = false;
    render(
      <Feature flag="test_feature">
        <div>Feature content</div>
      </Feature>
    );

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
  });

  it('renders fallback when feature flag is disabled', () => {
    mockFlagValue = false;
    render(
      <Feature flag="test_feature" fallback={<div>Coming soon</div>}>
        <div>Feature content</div>
      </Feature>
    );

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('renders null as fallback by default', () => {
    mockFlagValue = false;
    const { container } = render(
      <Feature flag="test_feature">
        <div>Feature content</div>
      </Feature>
    );

    expect(container.innerHTML).toBe('');
  });
});
