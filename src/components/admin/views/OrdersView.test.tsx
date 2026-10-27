import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeOrder } from '../../../test/factories';
import type { Order } from '../../../types';

const refresh = vi.fn().mockResolvedValue(true);
let state: { orders: Order[]; error: string | null; truncated: boolean };

vi.mock('../../../hooks/useOrders', () => ({
  useOrders: () => ({ ...state, isLoading: false, isRefreshing: false, refresh, patchOrder: vi.fn() }),
}));
const exportRowsToXlsx = vi.fn().mockResolvedValue(undefined);
const copyTextToClipboard = vi.fn().mockResolvedValue(true);
vi.mock('../../../utils/exportXlsx', () => ({
  exportRowsToXlsx: (...a: unknown[]) => exportRowsToXlsx(...a),
  copyTextToClipboard: (...a: unknown[]) => copyTextToClipboard(...a),
}));

import { OrdersView } from './OrdersView';

beforeEach(() => {
  state = { orders: [], error: null, truncated: false };
  exportRowsToXlsx.mockClear();
  copyTextToClipboard.mockClear();
});

describe('OrdersView', () => {
  it('reads the active tab from the URL, so a refresh keeps the filter', () => {
    state.orders = [
      makeOrder({ customer: 'Order Baru', productionStatus: 'WAITING_VALIDATION' }),
      makeOrder({ customer: 'Order Jalan', productionStatus: 'CUTTING' }),
    ];
    renderAt(<OrdersView />, '/admin/orders?status=new');
    expect(screen.getByText('Order Baru')).toBeInTheDocument();
    expect(screen.queryByText('Order Jalan')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /baru \/ antrean/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('plain /admin/orders shows everything (no leftover "new" filter)', () => {
    state.orders = [
      makeOrder({ customer: 'Order Baru', productionStatus: 'WAITING_VALIDATION' }),
      makeOrder({ customer: 'Order Jalan', productionStatus: 'CUTTING' }),
    ];
    renderAt(<OrdersView />, '/admin/orders');
    expect(screen.getByText('Order Baru')).toBeInTheDocument();
    expect(screen.getByText('Order Jalan')).toBeInTheDocument();
  });

  it('clicking a tab updates the URL', async () => {
    state.orders = [makeOrder({ productionStatus: 'READY_TO_SHIP' })];
    renderAt(<OrdersView />, '/admin/orders');
    fireEvent.click(screen.getByRole('tab', { name: /siap kirim/i }));
    await waitFor(() => expect(window.location.search).toBe('?status=ready_to_ship'));
  });

  it('paginates long lists (25 per page)', () => {
    state.orders = Array.from({ length: 60 }, (_, i) => makeOrder({ customer: `Cust ${String(i).padStart(2, '0')}` }));
    renderAt(<OrdersView />, '/admin/orders');
    expect(screen.getAllByRole('button', { name: /^Detail$/ })).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: /halaman berikutnya/i }));
    expect(screen.getAllByRole('button', { name: /^Detail$/ })).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: /halaman berikutnya/i }));
    expect(screen.getAllByRole('button', { name: /^Detail$/ })).toHaveLength(10);
  });

  it('finds a customer by phone digits regardless of formatting', () => {
    state.orders = [
      makeOrder({ customer: 'Target', phone: '0812-3456-7890' }),
      makeOrder({ customer: 'Lain', phone: '0899-0000-1111' }),
    ];
    renderAt(<OrdersView />, '/admin/orders');
    fireEvent.change(screen.getByLabelText(/cari pesanan/i), { target: { value: '0812 3456' } });
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.queryByText('Lain')).not.toBeInTheDocument();
  });

  it('production filter lists every status (incl. queue and rework), in Indonesian', () => {
    renderAt(<OrdersView />, '/admin/orders');
    const select = screen.getByLabelText(/filter tahap produksi/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['PRODUCTION_QUEUE', 'REWORK', 'DESIGN_REVISION', 'READY_TO_SHIP']));
  });

  it('shows a load error (with retry) instead of a misleading empty state', () => {
    state.error = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    renderAt(<OrdersView />, '/admin/orders');
    expect(screen.getByRole('alert')).toHaveTextContent(/gagal memuat data/i);
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
    expect(screen.queryByText('Belum ada pesanan masuk.')).not.toBeInTheDocument();
  });

  it('warns when the row cap hides older orders', () => {
    state.truncated = true;
    renderAt(<OrdersView />, '/admin/orders');
    expect(screen.getByRole('status')).toHaveTextContent(/2\.000/);
  });

  it('exports the filtered rows and reports failures', async () => {
    state.orders = [makeOrder({ customer: '=cmd|calc' })];
    renderAt(<OrdersView />, '/admin/orders');
    fireEvent.click(screen.getByRole('button', { name: /ekspor excel/i }));
    await waitFor(() => expect(exportRowsToXlsx).toHaveBeenCalled());
    const rows = exportRowsToXlsx.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].Customer).toBe('=cmd|calc'); // sanitising happens inside exportRowsToXlsx (tested separately)

    exportRowsToXlsx.mockRejectedValueOnce(new Error('disk'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /ekspor excel/i }));
    expect(await screen.findByText(/gagal mengekspor/i)).toBeInTheDocument();
  });

  it('offers the customer order link instead of a dead-end "create order" button', async () => {
    renderAt(<OrdersView />, '/admin/orders');
    fireEvent.click(screen.getByRole('button', { name: /salin link form pesanan/i }));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(`${window.location.origin}/custom-order`));
  });
});
