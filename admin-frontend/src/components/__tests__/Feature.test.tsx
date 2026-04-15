import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Feature } from '../Feature';

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(),
}));

import { useFeatureFlag } from '../../hooks/useFeatureFlag';

describe('Feature', () => {
  it('renders children when flag is enabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    render(
      <Feature flag="test-flag">
        <span>Feature content</span>
      </Feature>,
    );
    expect(screen.getByText('Feature content')).toBeInTheDocument();
  });

  it('does not render children when flag is disabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(
      <Feature flag="test-flag">
        <span>Feature content</span>
      </Feature>,
    );
    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
  });

  it('renders fallback when flag is disabled and fallback is provided', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(
      <Feature flag="test-flag" fallback={<span>Fallback</span>}>
        <span>Feature content</span>
      </Feature>,
    );
    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });

  it('does not render fallback when flag is enabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    render(
      <Feature flag="test-flag" fallback={<span>Fallback</span>}>
        <span>Feature content</span>
      </Feature>,
    );
    expect(screen.getByText('Feature content')).toBeInTheDocument();
    expect(screen.queryByText('Fallback')).not.toBeInTheDocument();
  });

  it('renders null as default fallback when flag is disabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    const { container } = render(
      <Feature flag="test-flag">
        <span>Feature content</span>
      </Feature>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('passes flag key to useFeatureFlag', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(
      <Feature flag="my-custom-flag">
        <span>Content</span>
      </Feature>,
    );
    expect(useFeatureFlag).toHaveBeenCalledWith('my-custom-flag');
  });
});
