import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeOrder } from '../../../test/factories';
import type { Order } from '../../../types';

let orders: Order[] = [];
vi.mock('../../../hooks/useOrders', () => ({
  useOrders: () => ({ orders, isLoading: false, isRefreshing: false, error: null, truncated: false, refresh: vi.fn(), patchOrder: vi.fn() }),
}));
vi.mock('../../../utils/storage', () => ({
  FALLBACK_STUDIO_PROFILE: { name: 'SIPASTEL', address: '', phone: '', bankName: '', bankAccountNumber: '', bankAccountHolder: '', logoUrl: null },
  getStoredStudioProfile: vi.fn().mockResolvedValue({
    name: 'SIPASTEL APPAREL', address: 'Jl. Merdeka 1, Sukabumi', phone: '0896-7734-3212',
    bankName: 'BCA', bankAccountNumber: '1234567890', bankAccountHolder: 'Owner Studio', logoUrl: null,
  }),
}));

import { CustomersView } from './CustomersView';
import { InvoicesView } from './InvoicesView';

beforeEach(() => {
  orders = [];
});

describe('CustomersView', () => {
  it('merges one person typed in different phone formats into a single customer', () => {
    orders = [
      makeOrder({ customer: 'Dimas', phone: '0812-3456-7890', totalPaid: 100000, createdAt: '2026-09-01T00:00:00Z' }),
      makeOrder({ customer: 'Dimas A.', phone: '+62 812 3456 7890', totalPaid: 50000, createdAt: '2026-09-10T00:00:00Z' }),
      makeOrder({ customer: 'Dimas', phone: '6281234567890', totalPaid: 25000, createdAt: '2026-09-05T00:00:00Z' }),
      makeOrder({ customer: 'Orang Lain', phone: '0899-0000-1111' }),
    ];
    renderAt(<CustomersView />, '/admin/customers');
    expect(screen.getByText('2 pelanggan')).toBeInTheDocument();
    const row = screen.getByText('Dimas A.').closest('tr')!; // newest order supplies the display name
    expect(within(row).getByText('3')).toBeInTheDocument(); // 3 orders
    expect(row.textContent).toMatch(/175\.000/); // 100k + 50k + 25k actually paid
  });

  it('builds a valid wa.me link even for a number typed with a leading 0', () => {
    orders = [makeOrder({ customer: 'Sari', phone: '0812-3456-7890' })];
    renderAt(<CustomersView />, '/admin/customers');
    const link = screen.getByRole('link', { name: /chat whatsapp sari/i });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('counts money actually received (DP), not the order value', () => {
    orders = [makeOrder({ phone: '0811', totalPrice: 900000, totalPaid: 300000 })];
    renderAt(<CustomersView />, '/admin/customers');
    expect(screen.getByText(/300\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/900\.000/)).not.toBeInTheDocument();
  });

  it('searches by phone digits and shows an honest empty state', () => {
    orders = [makeOrder({ customer: 'Target', phone: '0812-3456-7890' })];
    renderAt(<CustomersView />, '/admin/customers');
    fireEvent.change(screen.getByLabelText(/cari pelanggan/i), { target: { value: '0812 3456' } });
    expect(screen.getByText('Target')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/cari pelanggan/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/tidak ada pelanggan ditemukan/i)).toBeInTheDocument();
  });

  it('does not invent a city in the message', () => {
    orders = [makeOrder({ customer: 'Sari', phone: '0812' })];
    renderAt(<CustomersView />, '/admin/customers');
    expect(screen.getByRole('link', { name: /chat whatsapp sari/i }).getAttribute('href')).not.toMatch(/bogor/i);
  });
});

describe('InvoicesView', () => {
  it('shows what was paid, what remains, and where to pay - on the invoice itself', async () => {
    orders = [makeOrder({ customer: 'Budi', totalPrice: 1000000, totalPaid: 300000, remainingBalance: 700000, paymentStatus: 'DP_DIBAYAR', invoiceNumber: 'INV-900' })];
    renderAt(<InvoicesView />, '/admin/invoices');
    fireEvent.click(screen.getByRole('button', { name: /lihat/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/sudah dibayar/i)).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/300\.000/);
    expect(dialog.textContent).toMatch(/700\.000/);
    await waitFor(() => expect(dialog.textContent).toMatch(/BCA/));
    expect(dialog.textContent).toMatch(/1234567890/);
    expect(dialog.textContent).toMatch(/Owner Studio/);
    expect(dialog.textContent).toMatch(/Sukabumi/); // studio address from settings, not a hard-coded city
  });

  it('does not show bank instructions on a fully paid invoice', async () => {
    orders = [makeOrder({ totalPrice: 500000, totalPaid: 500000, remainingBalance: 0, paymentStatus: 'LUNAS' })];
    renderAt(<InvoicesView />, '/admin/invoices');
    fireEvent.click(screen.getByRole('button', { name: /lihat/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).not.toMatch(/Pembayaran via Transfer/i);
  });

  it('never claims a payment method that was not recorded', () => {
    orders = [makeOrder({ paymentMethod: undefined })];
    renderAt(<InvoicesView />, '/admin/invoices');
    expect(screen.queryByText(/bank transfer/i)).not.toBeInTheDocument();
  });

  it('marks unquoted orders instead of issuing a Rp0 invoice', () => {
    orders = [makeOrder({ totalPrice: 0 })];
    renderAt(<InvoicesView />, '/admin/invoices');
    expect(screen.getByText('Belum dihargai')).toBeInTheDocument();
  });

  it('closes the invoice with Escape', async () => {
    orders = [makeOrder({})];
    renderAt(<InvoicesView />, '/admin/invoices');
    fireEvent.click(screen.getByRole('button', { name: /lihat/i }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('paginates and searches by invoice number', () => {
    orders = Array.from({ length: 30 }, (_, i) => makeOrder({ invoiceNumber: `INV-${1000 + i}`, customer: `C${i}` }));
    renderAt(<InvoicesView />, '/admin/invoices');
    expect(screen.getAllByRole('button', { name: /lihat/i })).toHaveLength(25);
    fireEvent.change(screen.getByLabelText(/cari invoice/i), { target: { value: 'INV-1029' } });
    expect(screen.getAllByRole('button', { name: /lihat/i })).toHaveLength(1);
  });
});
