import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeOrder, makeUser } from '../../../test/factories';
import type { Order } from '../../../types';

const patchOrder = vi.fn();
const refresh = vi.fn().mockResolvedValue(true);
let orders: Order[] = [];
let perms: Record<string, boolean> = {};
let userName = 'Rina Kusuma';

vi.mock('../../../hooks/useOrders', () => ({
  useOrders: () => ({ orders, isLoading: false, isRefreshing: false, error: null, truncated: false, refresh, patchOrder }),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { ...makeUser('OWNER'), name: userName }, hasPermission: (p: string) => perms[p] ?? false }),
}));
const updateStoredOrderStatus = vi.fn();
const fetchValidPaymentsSince = vi.fn();
vi.mock('../../../utils/storage', () => ({
  updateStoredOrderStatus: (...a: unknown[]) => updateStoredOrderStatus(...a),
  fetchValidPaymentsSince: (...a: unknown[]) => fetchValidPaymentsSince(...a),
}));

import { DashboardView } from './DashboardView';

const monthsAgo = (n: number) => new Date(new Date().getFullYear(), new Date().getMonth() - n, 10, 12).toISOString();
const thisMonth = () => new Date().toISOString();

beforeEach(() => {
  patchOrder.mockReset();
  updateStoredOrderStatus.mockReset();
  fetchValidPaymentsSince.mockReset().mockResolvedValue({ data: [], error: null });
  perms = { 'finance:read': true, 'production:write': true, 'products:write': true, 'production:read': true, 'invoices:read': true };
  userName = 'Rina Kusuma';
  orders = [];
});

describe('DashboardView - honest numbers', () => {
  it('no longer shows the hard-coded "+12% bulan ini"', () => {
    orders = [makeOrder({ createdAt: thisMonth() })];
    renderAt(<DashboardView />);
    expect(screen.queryByText(/\+12%/)).not.toBeInTheDocument();
  });

  it('shows the real month-over-month change', () => {
    orders = [
      makeOrder({ createdAt: monthsAgo(1) }),
      makeOrder({ createdAt: monthsAgo(1) }),
      makeOrder({ createdAt: thisMonth() }),
      makeOrder({ createdAt: thisMonth() }),
      makeOrder({ createdAt: thisMonth() }),
    ];
    renderAt(<DashboardView />);
    expect(screen.getByText(/3 bulan ini \(\+50% vs bulan lalu\)/)).toBeInTheDocument();
  });

  it('shows no percentage when there is nothing to compare against', () => {
    orders = [makeOrder({ createdAt: thisMonth() })];
    renderAt(<DashboardView />);
    expect(screen.getByText('1 bulan ini')).toBeInTheDocument();
  });

  it('shows a decline as a decline', () => {
    orders = [makeOrder({ createdAt: monthsAgo(1) }), makeOrder({ createdAt: monthsAgo(1) }), makeOrder({ createdAt: thisMonth() })];
    renderAt(<DashboardView />);
    expect(screen.getByText(/-50% vs bulan lalu/)).toBeInTheDocument();
  });

  it('greets the signed-in person by first name, not a hard-coded "Admin"', () => {
    renderAt(<DashboardView />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/selamat (pagi|siang|sore|malam), rina/i);
    expect(screen.queryByText(/, admin/i)).not.toBeInTheDocument();
  });

  it('has no dead "Pesanan Baru -> /custom-order" button; the shortcut opens incoming orders', async () => {
    renderAt(<DashboardView />);
    expect(screen.queryByRole('button', { name: /^pesanan baru$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pesanan masuk/i }));
    await waitFor(() => expect(window.location.search).toBe('?status=new'));
    expect(window.location.pathname).toBe('/admin/orders');
  });
});

describe('DashboardView - role gating', () => {
  it('shows the revenue tab and loads payments for roles with finance access', async () => {
    renderAt(<DashboardView />);
    expect(screen.getByRole('button', { name: /pendapatan/i })).toBeInTheDocument();
    await waitFor(() => expect(fetchValidPaymentsSince).toHaveBeenCalled());
  });

  it('hides revenue and never queries payments for other roles', async () => {
    perms = { 'production:write': true, 'production:read': true };
    renderAt(<DashboardView />);
    expect(screen.queryByRole('button', { name: /pendapatan/i })).not.toBeInTheDocument();
    expect(fetchValidPaymentsSince).not.toHaveBeenCalled();
  });

  it('hides shortcuts to pages the role cannot open', () => {
    perms = { 'production:read': true };
    renderAt(<DashboardView />);
    expect(screen.queryByRole('button', { name: /lihat invoice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kelola produk/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lihat produksi/i })).toBeInTheDocument();
  });
});

describe('DashboardView - chart', () => {
  it('switches between 7 and 30 day ranges', () => {
    renderAt(<DashboardView />);
    expect(screen.getByRole('heading', { name: /7 hari terakhir/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '30 Hari' }));
    expect(screen.getByRole('heading', { name: /30 hari terakhir/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 Hari' }));
    expect(screen.getByRole('heading', { name: /7 hari terakhir/i })).toBeInTheDocument();
  });

  it('attributes revenue to the day the payment arrived, not the order date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    orders = [makeOrder({ createdAt: monthsAgo(1) })]; // old order, paid recently
    fetchValidPaymentsSince.mockResolvedValue({ data: [{ paidAt: yesterday.toISOString(), amount: 250000 }], error: null });
    renderAt(<DashboardView />);
    await waitFor(() => expect(fetchValidPaymentsSince).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /pendapatan/i }));
    const svg = screen.getByRole('img', { name: /grafik pendapatan/i });
    // One point sits above the baseline (yesterday); the order's creation month has no data in range.
    const circles = Array.from(svg.querySelectorAll('circle'));
    const ys = new Set(circles.map((c) => c.getAttribute('cy')));
    expect(ys.size).toBeGreaterThan(1);
  });
});

describe('DashboardView - moving an order forward', () => {
  it('uses the shared pipeline (cutting -> sewing) and refuses roles without production:write', () => {
    orders = [makeOrder({ productionStatus: 'CUTTING', isCustomOrder: true })];
    const { unmount } = renderAt(<DashboardView />);
    expect(screen.getByRole('button', { name: /lanjut ke jahit/i })).toBeInTheDocument();
    unmount();
    perms = { 'finance:read': true };
    renderAt(<DashboardView />);
    expect(screen.queryByRole('button', { name: /lanjut ke jahit/i })).not.toBeInTheDocument();
  });

  it('rolls back the on-screen stage if the database rejects the move', async () => {
    updateStoredOrderStatus.mockResolvedValue({ success: false, error: 'Anda tidak memiliki izin untuk melakukan tindakan ini.' });
    const o = makeOrder({ productionStatus: 'CUTTING', isCustomOrder: true });
    orders = [o];
    renderAt(<DashboardView />);
    fireEvent.click(screen.getByRole('button', { name: /lanjut ke jahit/i }));
    await waitFor(() => expect(patchOrder).toHaveBeenCalledTimes(2));
    expect(patchOrder).toHaveBeenNthCalledWith(1, o.orderId, { productionStatus: 'SEWING' });
    expect(patchOrder).toHaveBeenNthCalledWith(2, o.orderId, { productionStatus: 'CUTTING' });
    expect(await screen.findByText(/tidak memiliki izin/i)).toBeInTheDocument();
  });
});
