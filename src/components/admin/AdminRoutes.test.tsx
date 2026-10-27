import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderAt } from '../../test/render';
import { makeUser } from '../../test/factories';
import type { AdminUser } from '../../types';

const auth: { authStatus: string; user: AdminUser | null } = { authStatus: 'authenticated', user: makeUser('OWNER') };

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    authStatus: auth.authStatus,
    user: auth.user,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    clearExpiredState: vi.fn(),
  }),
}));

// Keep the test about routing/authorization: replace the heavy pages and shell.
vi.mock('./AdminLayout', () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div> }));
vi.mock('./AdminLoginPage', () => ({ AdminLoginPage: () => <div>LOGIN PAGE</div> }));
vi.mock('./views/DashboardView', () => ({ DashboardView: () => <div>DASHBOARD VIEW</div> }));
vi.mock('./views/OrdersView', () => ({ OrdersView: () => <div>ORDERS VIEW</div> }));
vi.mock('./views/OrderDetailView', () => ({ OrderDetailView: ({ orderId }: { orderId: string }) => <div>DETAIL {orderId}</div> }));
vi.mock('./views/ProductionView', () => ({ ProductionView: () => <div>PRODUCTION VIEW</div> }));
vi.mock('./views/ProductsView', () => ({ ProductsView: () => <div>PRODUCTS VIEW</div> }));
vi.mock('./views/CustomersView', () => ({ CustomersView: () => <div>CUSTOMERS VIEW</div> }));
vi.mock('./views/InvoicesView', () => ({ InvoicesView: () => <div>INVOICES VIEW</div> }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => <div>SETTINGS VIEW</div> }));

import { AdminRoutes, sanitizeNextPath } from './AdminRoutes';

beforeEach(() => {
  auth.authStatus = 'authenticated';
  auth.user = makeUser('OWNER');
});

describe('route authorization', () => {
  it.each([
    ['FINANCE', '/admin/production', 'PRODUCTION VIEW'],
    ['PRODUCTION_HEAD', '/admin/customers', 'CUSTOMERS VIEW'],
    ['PRODUCTION_HEAD', '/admin/invoices', 'INVOICES VIEW'],
  ] as const)('%s typing %s by hand is shown "Akses Ditolak", not the page', (role, path, pageText) => {
    auth.user = makeUser(role);
    renderAt(<AdminRoutes />, path);
    expect(screen.getByText('Akses Ditolak')).toBeInTheDocument();
    expect(screen.queryByText(pageText)).not.toBeInTheDocument();
  });

  it.each([
    ['OWNER', '/admin/production', 'PRODUCTION VIEW'],
    ['FINANCE', '/admin/invoices', 'INVOICES VIEW'],
    ['PRODUCTION_HEAD', '/admin/production', 'PRODUCTION VIEW'],
    ['FINANCE', '/admin/orders', 'ORDERS VIEW'],
  ] as const)('%s may open %s', (role, path, pageText) => {
    auth.user = makeUser(role);
    renderAt(<AdminRoutes />, path);
    expect(screen.getByText(pageText)).toBeInTheDocument();
  });

  it('decodes the order id in /admin/orders/:id', () => {
    renderAt(<AdminRoutes />, '/admin/orders/SPS-2026%2F1');
    expect(screen.getByText('DETAIL SPS-2026/1')).toBeInTheDocument();
  });

  it('falls back to the dashboard for unknown admin paths', () => {
    renderAt(<AdminRoutes />, '/admin/does-not-exist');
    expect(screen.getByText('DASHBOARD VIEW')).toBeInTheDocument();
  });
});

describe('authentication gate', () => {
  it('shows a loading state, never protected content, while the session is verified', () => {
    auth.authStatus = 'loading';
    auth.user = null;
    renderAt(<AdminRoutes />, '/admin/orders');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('ORDERS VIEW')).not.toBeInTheDocument();
  });

  it('sends anonymous visitors to login and remembers where they were going', async () => {
    auth.authStatus = 'unauthenticated';
    auth.user = null;
    renderAt(<AdminRoutes />, '/admin/orders?status=new');
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByText('ORDERS VIEW')).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/admin/login'));
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/admin/orders?status=new');
  });

  it('after login, returns to the requested page when the role may open it', async () => {
    auth.user = makeUser('FINANCE');
    renderAt(<AdminRoutes />, '/admin/login?next=%2Fadmin%2Finvoices');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/invoices'));
  });

  it('ignores a ?next= the role may not open and lands on a permitted page', async () => {
    auth.user = makeUser('FINANCE');
    renderAt(<AdminRoutes />, '/admin/login?next=%2Fadmin%2Fproduction');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/dashboard'));
  });
});

describe('sanitizeNextPath (open-redirect protection)', () => {
  it('only accepts in-app admin paths', () => {
    expect(sanitizeNextPath('/admin/orders?status=new')).toBe('/admin/orders?status=new');
    expect(sanitizeNextPath('https://evil.example')).toBeNull();
    expect(sanitizeNextPath('//evil.example')).toBeNull();
    expect(sanitizeNextPath('/admin/login')).toBeNull();
    expect(sanitizeNextPath('/custom-order')).toBeNull();
    expect(sanitizeNextPath(null)).toBeNull();
  });
});
