import React from 'react';

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
        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">Chart failed to render</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-sky-400 hover:text-sky-300"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
