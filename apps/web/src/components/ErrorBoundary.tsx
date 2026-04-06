import React from 'react';

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>{this.state.error}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            style={{ padding: '8px 16px', background: '#1a7a4c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
