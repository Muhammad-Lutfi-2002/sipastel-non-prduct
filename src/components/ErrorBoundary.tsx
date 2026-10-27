import React from 'react';
import { logClientError } from '../utils/clientErrorLog';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Which part of the app this boundary guards - included in the error log and shown to help support triage. */
  boundaryName: string;
  /** Rendered instead of the default screen when provided. */
  fallback?: (info: { message: string; reset: () => void }) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in the subtree below it so ONE broken
 * component shows a recoverable screen instead of taking the whole app to a
 * blank white page. Every caught error is also sent to logClientError() so
 * it is visible to the studio afterwards, not just in a customer's DevTools
 * console that nobody ever opens.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.boundaryName}]`, error, info.componentStack);
    void logClientError({
      boundary: this.props.boundaryName,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ message: error.message, reset: this.reset });
    }

    return <DefaultErrorScreen message={error.message} onReset={this.reset} />;
  }
}

/**
 * Deliberately styled with plain inline CSS, not Tailwind/theme classes.
 * This is the screen shown when something has already gone wrong, so it
 * must not depend on the app's own styling or theme context having loaded
 * correctly - it needs to render and be legible no matter what broke.
 */
const DefaultErrorScreen: React.FC<{ message: string; onReset: () => void }> = ({ message, onReset }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      background: '#141312',
      color: '#F5F3EE',
    }}
  >
    <div style={{ maxWidth: 420 }}>
      <p style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#A69E8F', marginBottom: 12 }}>
        SIPASTEL
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Terjadi kesalahan tak terduga</h1>
      <p style={{ fontSize: 14, color: '#D8D4CB', lineHeight: 1.6, marginBottom: 24 }}>
        Halaman ini mengalami error dan tidak bisa ditampilkan. Tim kami sudah menerima laporannya secara otomatis.
        Anda bisa mencoba lagi, atau muat ulang halaman.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '10px 20px',
            background: '#E2B857',
            color: '#141312',
            border: 'none',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Coba Lagi
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: '#F5F3EE',
            border: '1px solid #383633',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Muat Ulang Halaman
        </button>
      </div>
      {import.meta.env.DEV && (
        <pre style={{ marginTop: 24, fontSize: 11, color: '#A69E8F', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
          {message}
        </pre>
      )}
    </div>
  </div>
);
