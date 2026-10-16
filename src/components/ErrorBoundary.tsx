import React from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors so one bad record cannot blank the whole app. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    // (this as any): the project has no @types/react installed, so Component's props are untyped here.
    if (!this.state.error) return (this as any).props.children;
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>
          The page hit an unexpected error. Your saved quotes are safe. Try reloading; if it keeps happening, tell your administrator.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    );
  }
}
