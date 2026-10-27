import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const logClientError = vi.fn().mockResolvedValue(undefined);
vi.mock('../utils/clientErrorLog', () => ({ logClientError: (...a: unknown[]) => logClientError(...a) }));

import { ErrorBoundary } from './ErrorBoundary';

const Bomb: React.FC<{ armed: boolean }> = ({ armed }) => {
  if (armed) throw new Error('boom from a child component');
  return <div>all good</div>;
};

beforeEach(() => {
  logClientError.mockClear();
  // React logs the caught error to console.error too; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary boundaryName="test">
        <Bomb armed={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('catches a render error and shows the default recovery screen instead of a blank page', () => {
    render(
      <ErrorBoundary boundaryName="test">
        <Bomb armed />
      </ErrorBoundary>
    );
    expect(screen.getByText('Terjadi kesalahan tak terduga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /muat ulang halaman/i })).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
  });

  it('reports the error via logClientError, tagged with the boundary name', () => {
    render(
      <ErrorBoundary boundaryName="admin">
        <Bomb armed />
      </ErrorBoundary>
    );
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(logClientError.mock.calls[0][0]).toMatchObject({ boundary: 'admin', message: 'boom from a child component' });
  });

  it('uses a custom fallback when one is provided', () => {
    render(
      <ErrorBoundary boundaryName="test" fallback={({ message, reset }) => <button onClick={reset}>custom: {message}</button>}>
        <Bomb armed />
      </ErrorBoundary>
    );
    expect(screen.getByText('custom: boom from a child component')).toBeInTheDocument();
  });

  it('"Coba Lagi" re-renders the children, recovering once the underlying problem is gone', () => {
    const { rerender } = render(
      <ErrorBoundary boundaryName="test">
        <Bomb armed />
      </ErrorBoundary>
    );
    expect(screen.getByText('Terjadi kesalahan tak terduga')).toBeInTheDocument();

    rerender(
      <ErrorBoundary boundaryName="test">
        <Bomb armed={false} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }));
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});
