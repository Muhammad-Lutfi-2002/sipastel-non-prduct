import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeOrder } from '../../../test/factories';
import type { Order } from '../../../types';

const reload = vi.fn().mockResolvedValue(undefined);
let hook: { order: Order | null; activity: unknown[]; isLoading: boolean; error: string | null };
let perms: Record<string, boolean>;

vi.mock('../../../hooks/useOrder', () => ({ useOrder: () => ({ ...hook, reload }) }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms[p] ?? false, user: { id: 'u1', name: 'U', role: 'OWNER' } }),
}));
vi.mock('./PaymentHistoryPanel', () => ({ PaymentHistoryPanel: () => <div>PAYMENT PANEL</div> }));

const updateOrderDetails = vi.fn();
const addOrderActivity = vi.fn();
const updateOrderPrice = vi.fn();
vi.mock('../../../utils/storage', () => ({
  updateOrderDetails: (...a: unknown[]) => updateOrderDetails(...a),
  addOrderActivity: (...a: unknown[]) => addOrderActivity(...a),
  updateOrderPrice: (...a: unknown[]) => updateOrderPrice(...a),
}));

import { OrderDetailView } from './OrderDetailView';

const TRUSTED = 'https://test-project.supabase.co/storage/v1/object/public/design-uploads/SPS-1/a.png';

beforeEach(() => {
  reload.mockClear();
  updateOrderDetails.mockReset();
  addOrderActivity.mockReset().mockResolvedValue({ success: true });
  updateOrderPrice.mockReset();
  perms = { 'production:write': true, 'orders:write:price': true, 'invoices:read': true };
  hook = { order: makeOrder({ orderId: 'SPS-1', productionStatus: 'CUTTING' }), activity: [], isLoading: false, error: null };
});

const saveButton = () => screen.getByRole('button', { name: /simpan perubahan status/i });

describe('OrderDetailView - saving status', () => {
  it('saves to the database, writes the audit note, then reloads (no optimistic fake state)', async () => {
    updateOrderDetails.mockResolvedValue({ success: true });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    fireEvent.change(screen.getByLabelText(/tahap produksi/i), { target: { value: 'SEWING' } });
    fireEvent.change(screen.getByLabelText(/catatan operasional/i), { target: { value: 'Kain sudah dipotong' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateOrderDetails).toHaveBeenCalled());
    expect(updateOrderDetails.mock.calls[0][0]).toBe('SPS-1');
    expect(updateOrderDetails.mock.calls[0][1]).toMatchObject({ productionStatus: 'SEWING' });
    await waitFor(() => expect(addOrderActivity).toHaveBeenCalled());
    expect(addOrderActivity.mock.calls[0][0]).toMatchObject({ orderInternalId: hook.order!.id, previousStatus: 'CUTTING', newStatus: 'SEWING' });
    expect(addOrderActivity.mock.calls[0][0].note).toContain('Kain sudah dipotong');
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('shows the error and writes NO audit entry when the database refuses the change', async () => {
    updateOrderDetails.mockResolvedValue({ success: false, error: 'Anda tidak memiliki izin untuk melakukan tindakan ini.' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    fireEvent.change(screen.getByLabelText(/tahap produksi/i), { target: { value: 'SEWING' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(/gagal menyimpan: anda tidak memiliki izin/i)).toBeInTheDocument();
    expect(addOrderActivity).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('tells the user when nothing changed instead of pretending to save', async () => {
    renderAt(<OrderDetailView orderId="SPS-1" />);
    fireEvent.click(saveButton());
    expect(await screen.findByText(/tidak ada perubahan/i)).toBeInTheDocument();
    expect(updateOrderDetails).not.toHaveBeenCalled();
  });

  it('blocks shipping an order that is not ready, and demands a tracking number', async () => {
    renderAt(<OrderDetailView orderId="SPS-1" />);
    fireEvent.change(screen.getByLabelText(/^pengiriman$/i), { target: { value: 'SHIPPED' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(/siap kirim/i, { selector: '[role="alert"], [role="status"], div, p' })).toBeInTheDocument();
    expect(updateOrderDetails).not.toHaveBeenCalled();
  });

  it('offers every production status, including the ones the old dropdown was missing', () => {
    renderAt(<OrderDetailView orderId="SPS-1" />);
    const select = screen.getByLabelText(/tahap produksi/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['PRODUCTION_QUEUE', 'REWORK', 'DESIGN_REVISION']));
    const shipping = Array.from((screen.getByLabelText(/^pengiriman$/i) as HTMLSelectElement).options).map((o) => o.value);
    expect(shipping).toContain('SHIPPED');
  });

  it('selects the real current status when the order is in REWORK (was shown as the first option)', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', productionStatus: 'REWORK' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect((screen.getByLabelText(/tahap produksi/i) as HTMLSelectElement).value).toBe('REWORK');
  });
});

describe('OrderDetailView - permissions', () => {
  it('is read-only for a role without production:write (e.g. FINANCE)', () => {
    perms = { 'orders:write:price': true };
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.getByText(/hanya dapat melihat status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tahap produksi/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /setujui mockup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /minta revisi/i })).not.toBeInTheDocument();
  });

  it('only offers "Setujui Mockup" while the design is actually awaiting approval', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', productionStatus: 'DESIGN_APPROVAL' });
    const { unmount } = renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.getByRole('button', { name: /setujui mockup/i })).toBeInTheDocument();
    unmount();
    hook.order = makeOrder({ orderId: 'SPS-1', productionStatus: 'PACKING' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.queryByRole('button', { name: /setujui mockup/i })).not.toBeInTheDocument();
  });

  it('hides the invoice shortcut from roles that cannot open invoices', () => {
    perms = { 'production:write': true };
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.queryByRole('button', { name: /invoice #/i })).not.toBeInTheDocument();
  });
});

describe('OrderDetailView - customer design file safety', () => {
  it('renders a trusted image design inline', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', design: TRUSTED, designFileName: 'a.png' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.getByAltText(/mockup desain custom/i)).toHaveAttribute('src', TRUSTED);
  });

  it('never renders an <img> or link for a customer-supplied foreign URL', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', design: 'https://tracker.evil.example/pixel.png' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(document.querySelector('img[src*="evil"]')).toBeNull();
    expect(document.querySelector('a[href*="evil"]')).toBeNull();
    expect(screen.getByText(/tidak dikenal/i)).toBeInTheDocument();
  });

  it('never makes a javascript: design URL clickable', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', design: 'javascript:alert(document.cookie)' });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it('does not force a PDF/PSD into an <img> - shows a file card with an open link', () => {
    hook.order = makeOrder({
      orderId: 'SPS-1',
      design: 'https://test-project.supabase.co/storage/v1/object/public/design-uploads/SPS-1/a.pdf',
      designFileName: 'desain.pdf',
    });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.queryByAltText(/mockup desain custom/i)).not.toBeInTheDocument();
    expect(screen.getByText(/pratinjau tidak tersedia/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buka \/ unduh file/i })).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('does not invent file details when nothing was uploaded', () => {
    hook.order = makeOrder({ orderId: 'SPS-1', design: null, designFileName: null });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.getByText(/belum ada file desain/i)).toBeInTheDocument();
    expect(screen.queryByText(/cmyk|300 dpi|vector/i)).not.toBeInTheDocument();
  });
});

describe('OrderDetailView - price and states', () => {
  it('rejects a price below what was already paid', async () => {
    hook.order = makeOrder({ orderId: 'SPS-1', totalPrice: 0, totalPaid: 300000, remainingBalance: 0, isCustomOrder: true });
    renderAt(<OrderDetailView orderId="SPS-1" />);
    fireEvent.click(screen.getByRole('button', { name: /atur harga/i }));
    fireEvent.change(screen.getByLabelText(/total harga pesanan/i), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: /^simpan$/i }));
    expect(await screen.findByText(/tidak boleh lebih kecil dari total yang sudah dibayar/i)).toBeInTheDocument();
    expect(updateOrderPrice).not.toHaveBeenCalled();
  });

  it('distinguishes "not found" from "could not load"', () => {
    hook = { order: null, activity: [], isLoading: false, error: null };
    const { unmount } = renderAt(<OrderDetailView orderId="SPS-404" />);
    expect(screen.getByRole('heading', { name: /pesanan tidak ditemukan/i })).toBeInTheDocument();
    unmount();
    hook = { order: null, activity: [], isLoading: false, error: 'Tidak dapat terhubung ke server.' };
    renderAt(<OrderDetailView orderId="SPS-404" />);
    expect(screen.queryByRole('heading', { name: /pesanan tidak ditemukan/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/gagal memuat data/i);
  });

  it('shows the persisted history with its author', () => {
    hook.activity = [{ id: 'l1', timestamp: '2026-09-21T03:30:00Z', newStatus: 'SEWING', note: 'Jahit dimulai', authorName: 'Rina' }];
    renderAt(<OrderDetailView orderId="SPS-1" />);
    expect(screen.getByText('Jahit dimulai')).toBeInTheDocument();
    expect(screen.getByText(/oleh: rina/i)).toBeInTheDocument();
  });
});
