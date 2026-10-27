import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RouterProvider, useRouter } from './RouterContext';

const Probe: React.FC = () => {
  const { pathname, search, searchParams, navigate } = useRouter();
  return (
    <div>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="status">{searchParams.get('status') ?? 'none'}</span>
      <button onClick={() => navigate('/admin/orders?status=new')}>go-new</button>
      <button onClick={() => navigate('/admin/orders')}>go-all</button>
      <button onClick={() => navigate('https://evil.example/steal')}>go-external</button>
      <button onClick={() => navigate('/')}>go-root</button>
    </div>
  );
};

const setup = (url: string) => {
  window.history.replaceState({}, '', url);
  return render(
    <RouterProvider>
      <Probe />
    </RouterProvider>
  );
};

describe('RouterProvider', () => {
  it('keeps the query string separate from the path and reads it on first load', () => {
    setup('/admin/orders?status=ready_to_ship');
    expect(screen.getByTestId('path').textContent).toBe('/admin/orders');
    expect(screen.getByTestId('status').textContent).toBe('ready_to_ship');
  });

  it('updates path + query together and writes the full URL to the address bar', () => {
    setup('/admin/dashboard');
    act(() => screen.getByText('go-new').click());
    expect(screen.getByTestId('path').textContent).toBe('/admin/orders');
    expect(screen.getByTestId('status').textContent).toBe('new');
    expect(window.location.pathname + window.location.search).toBe('/admin/orders?status=new');
  });

  it('drops the filter when navigating to the plain page (no stale "new" tab)', () => {
    setup('/admin/orders?status=new');
    act(() => screen.getByText('go-all').click());
    expect(screen.getByTestId('status').textContent).toBe('none');
    expect(window.location.search).toBe('');
  });

  it('restores path AND query on the browser back button', () => {
    setup('/admin/dashboard');
    act(() => screen.getByText('go-new').click());
    act(() => {
      window.history.replaceState({}, '', '/admin/orders?status=custom');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('status').textContent).toBe('custom');
  });

  it('refuses to navigate to another origin', () => {
    setup('/admin/dashboard');
    act(() => screen.getByText('go-external').click());
    expect(screen.getByTestId('path').textContent).toBe('/admin/dashboard');
    expect(window.location.hostname).not.toBe('evil.example');
  });

  it('sends the hidden storefront root to the production board', () => {
    setup('/');
    expect(screen.getByTestId('path').textContent).toBe('/admin/production');
    expect(window.location.pathname).toBe('/admin/production');
  });
});
