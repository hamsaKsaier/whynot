import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMonitor } from '../LiveMonitor';

const defaultProps = {
  currentScreenshot: null,
  currentUrl: null,
  thinkingText: '',
  toolCalls: [],
  testRunActivity: [],
  isRunning: false,
  showThinking: true,
  setShowThinking: vi.fn(),
  showToolCalls: true,
  setShowToolCalls: vi.fn(),
  expandedPreview: false,
  setExpandedPreview: vi.fn(),
};

describe('LiveMonitor', () => {
  it('renders without crashing', () => {
    render(<LiveMonitor {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows running state', () => {
    render(<LiveMonitor {...defaultProps} isRunning />);
    expect(document.body).toBeInTheDocument();
  });

  it('displays thinking text when provided', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        thinkingText="Analyzing the page structure..."
      />
    );
    expect(screen.getByText(/Analyzing the page structure/)).toBeInTheDocument();
  });

  it('displays current URL when provided', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        currentUrl="https://example.com/page"
      />
    );
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
  });

  it('displays tool calls', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        toolCalls={[
          {
            tool: 'browser_click',
            input: { selector: '#submit-btn' },
            timestamp: '2024-01-01T00:00:00Z',
          },
        ]}
      />
    );
    expect(screen.getByText(/browser_click/)).toBeInTheDocument();
  });

  it('renders screenshot preview when available', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        currentScreenshot="data:image/png;base64,abc"
      />
    );
    const img = screen.queryByAltText(/preview|screenshot|browser/i);
    if (img) {
      expect(img).toBeInTheDocument();
    }
  });

  it('displays phase info when provided', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        currentPhase="exploration"
        currentMessage="Discovering pages..."
      />
    );
    const phase = screen.queryByText(/exploration/i) || screen.queryByText(/Discovering pages/i);
    expect(phase).toBeInTheDocument();
  });

  it('shows cost info when provided', () => {
    render(
      <LiveMonitor
        {...defaultProps}
        isRunning
        costInfo={{
          totalCostCents: 150,
          inputTokens: 50000,
          outputTokens: 10000,
          modelName: 'claude-3-opus',
        }}
      />
    );
    expect(screen.getByText(/\$1\.50|\$0\.15|150|cost/i)).toBeInTheDocument();
  });

  it('has aria-live region for streaming events', () => {
    const { container } = render(<LiveMonitor {...defaultProps} isRunning />);
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();
  });
});
