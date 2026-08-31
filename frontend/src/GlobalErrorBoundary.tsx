import React from 'react';

export class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("GlobalErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#fee2e2', color: '#991b1b', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          {import.meta.env.DEV ? (
            <>
              <pre>{this.state.error?.toString()}</pre>
              <pre>{this.state.error?.stack}</pre>
            </>
          ) : (
            <p>Please refresh the page. If the problem persists, contact support.</p>
          )}
        </div>
      );
    }

    return this.props.children; 
  }
}
