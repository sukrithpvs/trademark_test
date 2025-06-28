import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white dark:bg-black min-h-screen">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error Details:</h2>
              <pre className="text-sm text-red-700 bg-red-100 p-3 rounded overflow-auto max-h-64">
                {this.state.error?.toString()}
              </pre>
            </div>
            
            {this.state.errorInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Component Stack:</h2>
                <pre className="text-sm text-gray-600 bg-gray-100 p-3 rounded overflow-auto max-h-64">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
