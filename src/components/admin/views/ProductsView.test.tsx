import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import type { Product } from '../../../types';

let canWrite = true;
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => (p === 'products:write' ? canWrite : true), user: null }),
}));

const s = {
  fetchProducts: vi.fn(),
  updateStoredProduct: vi.fn(),
  createStoredProduct: vi.fn(),
  deleteStoredProduct: vi.fn(),
  toggleProductStock: vi.fn(),
  uploadProductImage: vi.fn(),
  deleteProductImageIfOwned: vi.fn(),
};
vi.mock('../../../utils/storage', () => ({
  MAX_PRODUCT_PRICE: 1_000_000_000,
  fetchProducts: (...a: unknown[]) => s.fetchProducts(...a),
  updateStoredProduct: (...a: unknown[]) => s.updateStoredProduct(...a),
  createStoredProduct: (...a: unknown[]) => s.createStoredProduct(...a),
  deleteStoredProduct: (...a: unknown[]) => s.deleteStoredProduct(...a),
  toggleProductStock: (...a: unknown[]) => s.toggleProductStock(...a),
  uploadProductImage: (...a: unknown[]) => s.uploadProductImage(...a),
  deleteProductImageIfOwned: (...a: unknown[]) => s.deleteProductImageIfOwned(...a),
}));

import { ProductsView } from './ProductsView';

const OLD = 'https://test-project.supabase.co/storage/v1/object/public/product-images/old.png';
const NEW = 'https://test-project.supabase.co/storage/v1/object/public/product-images/new.png';
const product = (over: Partial<Product> = {}): Product => ({
  id: 'prod-1', slug: 'kaos', name: 'Kaos Polos', category: 'KAOS', isBestSeller: false, isNew: false, price: 75000,
  formattedPrice: 'Rp75.000', shortDescription: '', description: '', material: '', fit: '', productionTime: '',
  careInstructions: [], sizes: [], colors: [], images: [OLD, 'gallery-2.png', 'gallery-3.png'], inStock: true, ...over,
});

beforeEach(() => {
  canWrite = true;
  Object.values(s).forEach((m) => m.mockReset());
  s.fetchProducts.mockResolvedValue({ data: [product()], error: null });
  s.deleteProductImageIfOwned.mockResolvedValue(undefined);
  s.updateStoredProduct.mockResolvedValue({ success: true });
});

const openEdit = async () => {
  renderAt(<ProductsView />, '/admin/products');
  await screen.findByText('Kaos Polos');
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  await screen.findByRole('dialog');
};

describe('ProductsView - image safety', () => {
  it('editing the name keeps the other gallery images (used to wipe them)', async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText(/nama produk/i), { target: { value: 'Kaos Premium' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    await waitFor(() => expect(s.updateStoredProduct).toHaveBeenCalled());
    expect(s.updateStoredProduct.mock.calls[0][1].images).toEqual([OLD, 'gallery-2.png', 'gallery-3.png']);
    expect(s.deleteProductImageIfOwned).not.toHaveBeenCalled(); // image unchanged -> nothing deleted
  });

  it('cancelling after uploading a new image deletes only the NEW file and never the original', async () => {
    s.uploadProductImage.mockResolvedValue({ success: true, url: NEW });
    await openEdit();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(s.uploadProductImage).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^batal$/i }));
    await waitFor(() => expect(s.deleteProductImageIfOwned).toHaveBeenCalledWith(NEW));
    expect(s.deleteProductImageIfOwned).not.toHaveBeenCalledWith(OLD);
    expect(s.updateStoredProduct).not.toHaveBeenCalled();
  });

  it('deletes the replaced original only AFTER the save succeeded', async () => {
    s.uploadProductImage.mockResolvedValue({ success: true, url: NEW });
    await openEdit();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(s.uploadProductImage).toHaveBeenCalled());
    expect(s.deleteProductImageIfOwned).not.toHaveBeenCalled(); // not at upload time
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    await waitFor(() => expect(s.deleteProductImageIfOwned).toHaveBeenCalledWith(OLD));
    expect(s.updateStoredProduct.mock.calls[0][1].images).toEqual([NEW, 'gallery-2.png', 'gallery-3.png']);
  });

  it('keeps the original image when the save fails', async () => {
    s.uploadProductImage.mockResolvedValue({ success: true, url: NEW });
    s.updateStoredProduct.mockResolvedValue({ success: false, error: 'Anda tidak memiliki izin.' });
    await openEdit();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(s.uploadProductImage).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    expect(await screen.findByText(/gagal menyimpan perubahan/i)).toBeInTheDocument();
    expect(s.deleteProductImageIfOwned).not.toHaveBeenCalledWith(OLD);
  });

  it('rejects a pasted image URL that is not http(s)', async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText(/url gambar produk/i), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    expect(await screen.findByText(/diawali http/i)).toBeInTheDocument();
    expect(s.updateStoredProduct).not.toHaveBeenCalled();
  });

  it('validates name and price', async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText(/nama produk/i), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/harga/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    expect(await screen.findByText(/nama produk wajib diisi/i)).toBeInTheDocument();
    expect(screen.getByText(/harga harus lebih dari/i)).toBeInTheDocument();
    expect(s.updateStoredProduct).not.toHaveBeenCalled();
  });
});

describe('ProductsView - behaviour', () => {
  it('closes the form with Escape and cleans up provisional uploads', async () => {
    s.uploadProductImage.mockResolvedValue({ success: true, url: NEW });
    await openEdit();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(s.uploadProductImage).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(s.deleteProductImageIfOwned).toHaveBeenCalledWith(NEW);
  });

  it('rolls the stock toggle back when the database refuses it', async () => {
    s.toggleProductStock.mockResolvedValue({ success: false, error: 'Anda tidak memiliki izin.' });
    renderAt(<ProductsView />, '/admin/products');
    await screen.findByText('Kaos Polos');
    fireEvent.click(screen.getByRole('button', { name: /ubah status stok kaos polos/i }));
    expect(await screen.findByText(/gagal memperbarui stok/i)).toBeInTheDocument();
    // ...and the badge is back to what the database really has.
    expect(screen.getByText('Tersedia')).toBeInTheDocument();
  });

  it('is read-only for roles without products:write', async () => {
    canWrite = false;
    renderAt(<ProductsView />, '/admin/products');
    await screen.findByText('Kaos Polos');
    expect(screen.queryByRole('button', { name: /tambah produk/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ubah status stok/i })).not.toBeInTheDocument();
    expect(screen.getByText(/hanya dapat melihat katalog/i)).toBeInTheDocument();
  });

  it('shows a load error with retry instead of an empty catalogue', async () => {
    s.fetchProducts.mockResolvedValue({ data: [], error: 'Tidak dapat terhubung ke server.' });
    renderAt(<ProductsView />, '/admin/products');
    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal memuat data/i);
  });
});
