import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderAt as baseRenderAt } from '../../test/render';
import { ThemeProvider } from '../../context/ThemeContext';
import { makeUser } from '../../test/factories';
import type { AdminUser } from '../../types';

const renderAt = (ui: React.ReactElement, url: string) => baseRenderAt(<ThemeProvider>{ui}</ThemeProvider>, url);

let user: AdminUser = makeUser('OWNER');
const logout = vi.fn().mockResolvedValue(undefined);
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user, logout, hasPermission: () => true, authStatus: 'authenticated' }),
}));
vi.mock('../../utils/storage', () => ({ getStoredStudioProfile: vi.fn().mockResolvedValue({ logoUrl: null, name: 'SIPASTEL' }) }));
vi.mock('./AdminNotificationCenter', () => ({ AdminNotificationCenter: () => <div data-testid="notif" /> }));
vi.mock('./AdminQuickSearchModal', () => ({
  AdminQuickSearchModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog" aria-label="Pencarian cepat" /> : null),
}));

import { AdminLayout } from './AdminLayout';

beforeEach(() => {
  user = makeUser('OWNER');
  logout.mockClear();
});

const sidebar = () => screen.getAllByRole('navigation')[0];
const navNames = () => within(sidebar()).getAllByRole('button').map((b) => b.textContent ?? '');

describe('AdminLayout navigation', () => {
  it('shows every section to the OWNER', () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    const names = navNames().join('|');
    for (const label of ['Dashboard', 'Semua Pesanan', 'Produksi', 'Katalog', 'Pelanggan', 'Invoice', 'Pengaturan']) {
      expect(names).toContain(label);
    }
  });

  it('hides workshop pages from FINANCE and money pages from PRODUCTION_HEAD', () => {
    user = makeUser('FINANCE');
    const finance = renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    let names = navNames().join('|');
    expect(names).not.toContain('Produksi');
    expect(names).not.toMatch(/Desain|QC/);
    expect(names).toContain('Invoice');
    finance.unmount();

    user = makeUser('PRODUCTION_HEAD');
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    names = navNames().join('|');
    expect(names).not.toContain('Invoice');
    expect(names).not.toContain('Pelanggan');
    expect(names).toContain('Produksi');
  });

  it('marks exactly one item active: "Pesanan Baru" (not also "Semua Pesanan") on ?status=new', () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/orders?status=new');
    const current = within(sidebar()).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Pesanan Baru');
  });

  it('marks "Semua Pesanan" only on the unfiltered list', () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/orders');
    const current = within(sidebar()).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.map((b) => b.textContent)).toEqual([expect.stringContaining('Semua Pesanan')]);
  });

  it('navigates with the query string intact', async () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    fireEvent.click(within(sidebar()).getByRole('button', { name: /siap kirim/i }));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/admin/orders?status=ready_to_ship'));
  });
});

describe('AdminLayout honesty and behaviour', () => {
  it('has no fake "ESC" hint or hard-coded "Online" claim; connection status is real', () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    expect(screen.queryByText('ESC')).not.toBeInTheDocument();
    expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    return waitFor(() => expect(screen.getAllByText('Offline').length).toBeGreaterThan(0)).finally(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
  });

  it('logs out only after confirmation, waits for sign-out, then goes to login', async () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    fireEvent.click(screen.getAllByRole('button', { name: /keluar/i })[0]);
    expect(logout).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: /konfirmasi keluar/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^keluar/i }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.pathname).toBe('/admin/login'));
  });

  it('Escape closes the logout confirmation without logging out', async () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    fireEvent.click(screen.getAllByRole('button', { name: /keluar/i })[0]);
    await screen.findByRole('dialog', { name: /konfirmasi keluar/i });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /konfirmasi keluar/i })).not.toBeInTheDocument());
    expect(logout).not.toHaveBeenCalled();
  });

  it('Ctrl+K opens quick search', async () => {
    renderAt(<AdminLayout><div>page</div></AdminLayout>, '/admin/dashboard');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: /pencarian cepat/i })).toBeInTheDocument();
  });
});
