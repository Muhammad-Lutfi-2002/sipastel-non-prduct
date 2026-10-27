import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chain, mockSupabase, storageBucket, resetSupabaseMock } from '../test/supabaseMock';

vi.mock('../lib/supabaseClient', () => ({ supabase: mockSupabase }));

import {
  updateOrderDetails,
  updateStoredOrderStatus,
  updateOrderPrice,
  deleteStoredProduct,
  updateStoredProduct,
  trackOrder,
  fetchOrders,
  ownedObjectPath,
  removeStudioLogo,
  uploadStudioLogo,
  recordPayment,
  voidPayment,
  uploadDesignFile,
} from './storage';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pngFile = (name = 'logo.png') => new File([PNG], name, { type: 'image/png' });
const LOGO_URL = 'https://test-project.supabase.co/storage/v1/object/public/branding-assets/logo-old.png';

beforeEach(() => {
  resetSupabaseMock();
});

describe('writes are confirmed by the database (RLS "0 rows" is not a success)', () => {
  it('updateOrderDetails fails when no row was updated', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: [], error: null }));
    const res = await updateOrderDetails('SPS-1', { productionStatus: 'CUTTING' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/izin/);
  });

  it('updateOrderDetails succeeds when a row changed, and sends only the given fields', async () => {
    const q = chain({ data: [{ id: 'x' }], error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    const res = await updateOrderDetails('SPS-1', { productionStatus: 'CUTTING', trackingNumber: '  R1 ' });
    expect(res).toEqual({ success: true });
    const update = q.calls.find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ production_status: 'CUTTING', tracking_number: 'R1' });
  });

  it('updateStoredOrderStatus with nothing to change does not hit the database', async () => {
    expect(await updateStoredOrderStatus('SPS-1')).toEqual({ success: true });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('surfaces database errors as friendly messages', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: { code: '42501', message: 'rls' } }));
    const res = await updateStoredOrderStatus('SPS-1', 'CUTTING');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/izin/);
  });

  it('deleteStoredProduct reports a silent RLS refusal', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: [], error: null }));
    expect((await deleteStoredProduct('prod-1')).success).toBe(false);
  });

  it('voidPayment explains that only the Owner can void', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: [], error: null }));
    const res = await voidPayment('p1', 'u1', 'salah catat');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Owner/);
  });
});

describe('input guards', () => {
  it('rejects invalid prices before calling the database', async () => {
    expect((await updateOrderPrice('SPS-1', -5)).success).toBe(false);
    expect((await updateOrderPrice('SPS-1', NaN)).success).toBe(false);
    expect((await updateOrderPrice('SPS-1', 1e15)).success).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects non-positive payments client-side', async () => {
    const res = await recordPayment({
      orderInternalId: 'o', invoiceId: 'i', amount: 0, paymentType: 'DP', paymentMethod: 'Transfer', recordedBy: 'u',
    });
    expect(res.success).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('updateStoredProduct', () => {
  it('keeps the whole image gallery when the caller passes it (no data loss on edit)', async () => {
    const q = chain({ data: [{ id: 'p' }], error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    await updateStoredProduct('prod-1', { name: '  Kaos  ', images: ['a.png', 'b.png', 'c.png'] });
    const payload = q.calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>;
    expect(payload).toEqual({ name: 'Kaos', images: ['a.png', 'b.png', 'c.png'] });
  });

  it('validates the price and skips empty patches', async () => {
    expect((await updateStoredProduct('p', { price: 0 })).success).toBe(false);
    expect(await updateStoredProduct('p', {})).toEqual({ success: true });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('trackOrder', () => {
  it('finds an order stored with a different phone spelling by trying the variants', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [], error: null }) // "0812-3456-7890"
      .mockResolvedValueOnce({ data: [], error: null }) // "6281234567890"
      .mockResolvedValueOnce({ data: [{ id: 'u', order_id: 'SPS-1', customer: 'Budi', phone: '081234567890', items: [], quantity: 1 }], error: null });
    const order = await trackOrder(' SPS-1 ', '0812-3456-7890');
    expect(order?.orderId).toBe('SPS-1');
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    expect(mockSupabase.rpc.mock.calls[0][1]).toEqual({ p_order_id: 'SPS-1', p_phone: '0812-3456-7890' });
    expect(mockSupabase.rpc.mock.calls[2][1].p_phone).toBe('081234567890');
  });

  it('returns null without calling the server for a blank ID and stops on errors', async () => {
    expect(await trackOrder('  ', '0812')).toBeNull();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await trackOrder('SPS-1', '0812')).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('fetchOrders', () => {
  it('reports a failed load instead of pretending there are no orders', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: { message: 'Failed to fetch' } }));
    const res = await fetchOrders();
    expect(res.data).toEqual([]);
    expect(res.error).toMatch(/koneksi/i);
  });

  it('flags truncation when the row cap is hit', async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: `${i}`, order_id: `S${i}`, customer: 'x', phone: '1', items: [], quantity: 1 }));
    mockSupabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));
    const res = await fetchOrders();
    expect(res.error).toBeNull();
    expect(res.truncated).toBe(true);
  });
});

describe('ownedObjectPath', () => {
  it('extracts the object path only for our own bucket', () => {
    expect(ownedObjectPath(LOGO_URL, 'branding-assets')).toBe('logo-old.png');
    expect(ownedObjectPath(`${LOGO_URL}?t=1`, 'branding-assets')).toBe('logo-old.png');
    expect(ownedObjectPath(LOGO_URL, 'product-images')).toBeNull();
    expect(ownedObjectPath('https://cdn.example.com/x.png', 'branding-assets')).toBeNull();
    expect(ownedObjectPath(null, 'branding-assets')).toBeNull();
  });
  it('decodes encoded names', () => {
    expect(ownedObjectPath('https://a.supabase.co/storage/v1/object/public/branding-assets/my%20logo.png', 'branding-assets')).toBe('my logo.png');
  });
});

describe('studio logo lifecycle', () => {
  it('removeStudioLogo clears the DB reference BEFORE deleting the file', async () => {
    const order: string[] = [];
    mockSupabase.from.mockImplementationOnce(() => {
      order.push('db');
      return chain({ data: [{ id: true }], error: null });
    });
    storageBucket.remove.mockImplementation(async () => {
      order.push('storage');
      return { data: [], error: null };
    });
    const res = await removeStudioLogo(LOGO_URL);
    expect(res.success).toBe(true);
    expect(order).toEqual(['db', 'storage']);
  });

  it('removeStudioLogo keeps the file if the DB update is refused', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: [], error: null }));
    const res = await removeStudioLogo(LOGO_URL);
    expect(res.success).toBe(false);
    expect(storageBucket.remove).not.toHaveBeenCalled();
  });

  it('uploadStudioLogo removes the freshly uploaded file when saving the reference fails', async () => {
    storageBucket.upload.mockResolvedValueOnce({ error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://test-project.supabase.co/storage/v1/object/public/branding-assets/new.png' } });
    mockSupabase.from.mockReturnValueOnce(chain({ data: [], error: null })); // owner-only update refused
    const res = await uploadStudioLogo(pngFile(), LOGO_URL);
    expect(res.success).toBe(false);
    expect(storageBucket.remove).toHaveBeenCalledTimes(1);
    const removedPath = storageBucket.remove.mock.calls[0][0][0] as string;
    expect(removedPath).toMatch(/^logo-\d+-[0-9a-f]{4}\.png$/); // the NEW file, not the old logo
  });

  it('uploadStudioLogo deletes the previous logo only after the new one is saved', async () => {
    storageBucket.upload.mockResolvedValueOnce({ error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://test-project.supabase.co/storage/v1/object/public/branding-assets/new.png' } });
    mockSupabase.from.mockReturnValueOnce(chain({ data: [{ id: true }], error: null }));
    const res = await uploadStudioLogo(pngFile(), LOGO_URL);
    expect(res.success).toBe(true);
    expect(storageBucket.remove).toHaveBeenCalledWith(['logo-old.png']);
  });

  it('uploadStudioLogo refuses a non-image before uploading anything', async () => {
    const res = await uploadStudioLogo(new File(['<html>'], 'logo.png', { type: 'image/png' }));
    expect(res.success).toBe(false);
    expect(storageBucket.upload).not.toHaveBeenCalled();
  });
});

describe('uploadDesignFile', () => {
  it('uploads under a generated name (never the customer\'s file name) with the detected extension', async () => {
    storageBucket.upload.mockResolvedValueOnce({ error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://x/y.png' } });
    const res = await uploadDesignFile(pngFile('../../etc/passwd.exe'), 'SPS-2026 09/21');
    expect(res).toEqual({ success: true, url: 'https://x/y.png' });
    const path = storageBucket.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^SPS-2026_09_21\/\d+-[0-9a-f]{12}\.png$/);
    expect(path).not.toMatch(/passwd|exe|\.\./);
  });

  it('returns a readable error for an unsupported file without touching storage', async () => {
    const res = await uploadDesignFile(new File(['MZ'], 'a.png', { type: 'image/png' }), 'SPS-1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Format/);
    expect(storageBucket.upload).not.toHaveBeenCalled();
  });
});
