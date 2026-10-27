import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeOrder } from '../../../test/factories';
import type { Order } from '../../../types';

const patchOrder = vi.fn();
const refresh = vi.fn().mockResolvedValue(true);
let orders: Order[] = [];
let canWrite = true;

vi.mock('../../../hooks/useOrders', () => ({
  useOrders: () => ({ orders, isLoading: false, isRefreshing: false, error: null, truncated: false, refresh, patchOrder }),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => (p === 'production:write' ? canWrite : true), user: null }),
}));
const updateStoredOrderStatus = vi.fn();
vi.mock('../../../utils/storage', () => ({ updateStoredOrderStatus: (...a: unknown[]) => updateStoredOrderStatus(...a) }));

import { ProductionView } from './ProductionView';

beforeEach(() => {
  patchOrder.mockReset();
  updateStoredOrderStatus.mockReset();
  canWrite = true;
  orders = [];
});

describe('ProductionView', () => {
  it('does not list orders that already left the workshop', () => {
    orders = [
      makeOrder({ customer: 'Masih Produksi', productionStatus: 'CUTTING' }),
      makeOrder({ customer: 'Sudah Dikirim', productionStatus: 'READY_TO_SHIP', shippingStatus: 'SHIPPED' }),
      makeOrder({ customer: 'Sudah Selesai', productionStatus: 'READY_TO_SHIP', shippingStatus: 'COMPLETED' }),
    ];
    renderAt(<ProductionView />, '/admin/production');
    expect(screen.getByText('Masih Produksi')).toBeInTheDocument();
    expect(screen.queryByText('Sudah Dikirim')).not.toBeInTheDocument();
    expect(screen.queryByText('Sudah Selesai')).not.toBeInTheDocument();
  });

  it('offers the correct NEXT step per status: cutting goes to sewing, not straight to printing', () => {
    orders = [makeOrder({ customer: 'Ani', productionStatus: 'CUTTING' })];
    renderAt(<ProductionView />, '/admin/production');
    expect(screen.getByRole('button', { name: /lanjut ke jahit/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kirim ke sablon/i })).not.toBeInTheDocument();
  });

  it('cannot skip design approval', () => {
    orders = [makeOrder({ customer: 'Budi', productionStatus: 'DESIGN_APPROVAL' })];
    renderAt(<ProductionView />, '/admin/production');
    expect(screen.queryByRole('button', { name: /mulai potong bahan/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tandai disetujui/i })).toBeInTheDocument();
  });

  it('gives packing orders a way to become ready to ship', () => {
    orders = [makeOrder({ customer: 'Cici', productionStatus: 'PACKING' })];
    renderAt(<ProductionView />, '/admin/production');
    expect(screen.getByRole('button', { name: /tandai siap kirim/i })).toBeInTheDocument();
  });

  it('advances an order and reports success', async () => {
    updateStoredOrderStatus.mockResolvedValue({ success: true });
    const o = makeOrder({ customer: 'Dedi', productionStatus: 'SEWING' });
    orders = [o];
    renderAt(<ProductionView />, '/admin/production');
    fireEvent.click(screen.getByRole('button', { name: /kirim ke sablon/i }));
    await waitFor(() => expect(updateStoredOrderStatus).toHaveBeenCalledWith(o.orderId, 'PRINTING'));
    expect(patchOrder).toHaveBeenCalledWith(o.orderId, { productionStatus: 'PRINTING' });
    expect(await screen.findByText(/dipindahkan ke/i)).toBeInTheDocument();
  });

  it('puts the previous stage back and shows the error when the database refuses', async () => {
    updateStoredOrderStatus.mockResolvedValue({ success: false, error: 'Anda tidak memiliki izin untuk melakukan tindakan ini.' });
    const o = makeOrder({ customer: 'Eko', productionStatus: 'QC' });
    orders = [o];
    renderAt(<ProductionView />, '/admin/production');
    fireEvent.click(screen.getByRole('button', { name: /lolos qc/i }));
    await waitFor(() => expect(patchOrder).toHaveBeenCalledTimes(2));
    expect(patchOrder).toHaveBeenNthCalledWith(1, o.orderId, { productionStatus: 'PACKING' });
    expect(patchOrder).toHaveBeenNthCalledWith(2, o.orderId, { productionStatus: 'QC' }); // rolled back
    expect(await screen.findByText(/tidak memiliki izin/i)).toBeInTheDocument();
  });

  it('shows no advance buttons to a role without production:write', () => {
    canWrite = false;
    orders = [makeOrder({ customer: 'Fani', productionStatus: 'CUTTING' })];
    renderAt(<ProductionView />, '/admin/production');
    expect(screen.queryByRole('button', { name: /lanjut ke jahit/i })).not.toBeInTheDocument();
  });

  it('summary counts only orders still in the workshop', () => {
    orders = [
      makeOrder({ productionStatus: 'CUTTING', quantity: 10 }),
      makeOrder({ productionStatus: 'PRINTING', quantity: 5 }),
      makeOrder({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'DELIVERED', quantity: 100 }),
    ];
    renderAt(<ProductionView />, '/admin/production');
    // "Total Volume: <strong>15</strong> pcs" - the 100 shipped pieces must not be counted.
    expect(screen.getByText('15', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText('115', { selector: 'strong' })).not.toBeInTheDocument();
  });
});
