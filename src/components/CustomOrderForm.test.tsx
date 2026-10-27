import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Product } from '../types';

const addStoredOrder = vi.fn();
const uploadDesignFile = vi.fn();
vi.mock('../utils/storage', () => ({
  MAX_DESIGN_FILE_BYTES: 3 * 1024 * 1024,
  addStoredOrder: (...a: unknown[]) => addStoredOrder(...a),
  uploadDesignFile: (...a: unknown[]) => uploadDesignFile(...a),
  getStoredStudioProfile: vi.fn().mockResolvedValue({
    name: 'SIPASTEL', address: '', phone: '', bankName: 'BCA', bankAccountNumber: '123', bankAccountHolder: 'Owner', logoUrl: null,
  }),
  getStoredProducts: vi.fn().mockResolvedValue([
    {
      id: 'prod-77', slug: 'jersey', name: 'Jersey Sublimasi', category: 'JERSEY', price: 150000, images: [], inStock: true,
      isBestSeller: false, isNew: false, formattedPrice: 'Rp150.000', shortDescription: '', description: '', material: '', fit: '',
      productionTime: '', careInstructions: [], sizes: [], colors: [],
    } as Product,
  ]),
}));

import { CustomOrderForm } from './CustomOrderForm';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const next = () => fireEvent.click(screen.getByRole('button', { name: /lanjut/i }));
const type = (placeholder: RegExp | string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

async function reachStep7(withFile = false) {
  const onSuccess = vi.fn();
  render(<CustomOrderForm onSuccessOrder={onSuccess} />);
  type('Contoh: Dimas Aditya', 'Dimas Aditya');
  type('Contoh: 081234567890', '0812-3456-7890');
  next();
  fireEvent.click(await screen.findByText('Jersey Sublimasi'));
  next();
  next(); // step 3 has usable defaults
  if (withFile) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([PNG], 'desain.png', { type: 'image/png' })] } });
    expect(await screen.findByText(/desain\.png/)).toBeInTheDocument(); // file accepted and shown
  }
  next();
  type(/Sablon logo di dada kiri/, 'Logo dada kiri, tipografi punggung');
  next();
  type(/Nama jalan, nomor rumah/, 'Jl. Merdeka No. 10, Bogor');
  type('Contoh: Bogor', 'Bogor');
  next();
  fireEvent.click(screen.getByRole('button', { name: /dp \(uang muka\)/i }));
  fireEvent.click(screen.getByRole('button', { name: '30%' }));
  return { onSuccess };
}
const submit = () => fireEvent.click(document.getElementById('submit-custom-order-btn')!);

beforeEach(() => {
  addStoredOrder.mockReset().mockResolvedValue({ success: true });
  uploadDesignFile.mockReset();
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

describe('CustomOrderForm', () => {
  it('pressing Enter (form submit) on an early step moves forward instead of creating a half-filled order', () => {
    render(<CustomOrderForm />);
    type('Contoh: Dimas Aditya', 'Dimas');
    type('Contoh: 081234567890', '081234567890');
    fireEvent.submit(document.querySelector('form')!);
    expect(addStoredOrder).not.toHaveBeenCalled();
    expect(screen.getByText(/langkah 02 dari 07/i)).toBeInTheDocument();
  });

  it('enforces validation on the early step even via Enter', () => {
    render(<CustomOrderForm />);
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByText('Nama wajib diisi.')).toBeInTheDocument();
    expect(addStoredOrder).not.toHaveBeenCalled();
  });

  it('validates email format and WhatsApp length', () => {
    render(<CustomOrderForm />);
    type('Contoh: Dimas Aditya', 'Dimas');
    type('Contoh: 081234567890', '0812');
    type('Contoh: dimas@gmail.com', 'bukan-email');
    next();
    expect(screen.getByText(/minimal 9 digit/i)).toBeInTheDocument();
    expect(screen.getByText('Format email tidak valid.')).toBeInTheDocument();
  });

  it('is written in Indonesian throughout the step chrome', () => {
    render(<CustomOrderForm />);
    expect(screen.getByRole('button', { name: /lanjut/i })).toBeInTheDocument();
    expect(screen.queryByText(/^continue$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/step 01 of 07/i)).not.toBeInTheDocument();
  });

  it('submits once with a well-formed order ID and the catalog product id (so the server can verify the price)', async () => {
    const { onSuccess } = await reachStep7();
    submit();
    await waitFor(() => expect(addStoredOrder).toHaveBeenCalledTimes(1));
    const order = addStoredOrder.mock.calls[0][0];
    expect(order.orderId).toMatch(/^SPS-\d{8}-[A-HJ-NP-Z2-9]{6}$/);
    expect(order.items[0].productId).toBe('prod-77');
    expect(order.productionStatus).toBe('WAITING_VALIDATION');
    expect(order.shippingStatus).toBe('NOT_SHIPPED');
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('reuses the SAME order id when the customer retries after a failed submit', async () => {
    addStoredOrder.mockResolvedValueOnce({ success: false, error: 'Tidak dapat terhubung ke server.' });
    await reachStep7();
    submit();
    expect(await screen.findByText(/tidak dapat terhubung ke server/i)).toBeInTheDocument();
    submit();
    await waitFor(() => expect(addStoredOrder).toHaveBeenCalledTimes(2));
    expect(addStoredOrder.mock.calls[1][0].orderId).toBe(addStoredOrder.mock.calls[0][0].orderId);
  });

  it('does not create the order when the design upload fails, and says why', async () => {
    uploadDesignFile.mockResolvedValue({ success: false, error: 'Gagal mengunggah file desain. Coba lagi.' });
    await reachStep7(true);
    submit();
    expect(await screen.findByText(/gagal mengunggah file desain/i)).toBeInTheDocument();
    expect(addStoredOrder).not.toHaveBeenCalled();
  });

  it('uploads the design once and stores its URL, even if the order insert has to be retried', async () => {
    uploadDesignFile.mockResolvedValue({ success: true, url: 'https://test-project.supabase.co/storage/v1/object/public/design-uploads/x/a.png' });
    addStoredOrder.mockResolvedValueOnce({ success: false, error: 'Coba lagi.' });
    await reachStep7(true);
    submit();
    await screen.findByText(/coba lagi/i);
    submit();
    await waitFor(() => expect(addStoredOrder).toHaveBeenCalledTimes(2));
    expect(uploadDesignFile).toHaveBeenCalledTimes(1);
    expect(addStoredOrder.mock.calls[1][0].design).toContain('/design-uploads/');
  });

  it('rejects a disguised file (HTML renamed to .png) before anything is uploaded', async () => {
    render(<CustomOrderForm />);
    type('Contoh: Dimas Aditya', 'Dimas');
    type('Contoh: 081234567890', '081234567890');
    next();
    fireEvent.click(await screen.findByText('Jersey Sublimasi'));
    next();
    next();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['<html><script>alert(1)</script></html>'], 'evil.png', { type: 'image/png' })] } });
    expect(await screen.findByText(/format file tidak didukung/i)).toBeInTheDocument();
    expect(uploadDesignFile).not.toHaveBeenCalled();
  });
});
