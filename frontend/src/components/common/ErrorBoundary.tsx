import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Here you could also log to an error reporting service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-red-900/30 rounded-full">
                <FiAlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Something went wrong
            </h1>

            <p className="text-slate-400 text-center mb-6">
              We encountered an unexpected error. Don't worry, your data is safe.
            </p>

            {(import.meta.env.DEV ?? import.meta.env.MODE === 'development') && this.state.error && (
              <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                <p className="text-sm font-mono text-red-600 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer font-semibold mb-2">
                      Stack Trace
                    </summary>
                    <pre className="whitespace-pre-wrap overflow-auto max-h-48">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleReset} variant="primary" className="w-full">
                <FiRefreshCw className="inline mr-2" />
                Try Again
              </Button>

              <Button onClick={this.handleReload} variant="secondary" className="w-full">
                Reload Page
              </Button>

              <Button onClick={this.handleGoHome} variant="secondary" className="w-full">
                <FiHome className="inline mr-2" />
                Go to Home
              </Button>
            </div>

            <p className="mt-6 text-xs text-slate-400 text-center">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
