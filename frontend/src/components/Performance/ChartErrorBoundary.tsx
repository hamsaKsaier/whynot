import React from 'react';
import i18next from 'i18next';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">{i18next.t('runner.performance.chartError', { ns: 'runner' })}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-sky-400 hover:text-sky-300"
          >
            {i18next.t('runner.performance.chartRetry', { ns: 'runner' })}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
