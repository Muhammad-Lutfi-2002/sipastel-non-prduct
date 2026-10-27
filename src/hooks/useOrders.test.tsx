import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { makeOrder } from '../test/factories';

const fetchOrders = vi.fn();
vi.mock('../utils/storage', () => ({ fetchOrders: (...a: unknown[]) => fetchOrders(...a) }));

import { useOrders } from './useOrders';

beforeEach(() => fetchOrders.mockReset());
afterEach(() => vi.useRealTimers());

const ok = (orders = [makeOrder()], truncated = false) => ({ data: orders, error: null, truncated });

describe('useOrders', () => {
  it('loads on mount and reports loading only for the first load', async () => {
    fetchOrders.mockResolvedValue(ok());
    const { result } = renderHook(() => useOrders());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('keeps the orders already on screen when a refresh fails, and reports the error', async () => {
    fetchOrders.mockResolvedValueOnce(ok([makeOrder({ customer: 'Tetap' })]));
    const { result } = renderHook(() => useOrders());
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    fetchOrders.mockResolvedValueOnce({ data: [], error: 'Tidak dapat terhubung ke server.', truncated: false });
    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.refresh();
    });
    expect(succeeded).toBe(false);
    expect(result.current.error).toMatch(/terhubung/);
    expect(result.current.orders.map((o) => o.customer)).toEqual(['Tetap']); // not wiped
  });

  it('clears the error after a later successful refresh', async () => {
    fetchOrders.mockResolvedValueOnce({ data: [], error: 'gagal', truncated: false });
    const { result } = renderHook(() => useOrders());
    await waitFor(() => expect(result.current.error).toBe('gagal'));
    expect(result.current.isLoading).toBe(false);
    fetchOrders.mockResolvedValueOnce(ok([makeOrder(), makeOrder()], true));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.orders).toHaveLength(2);
    expect(result.current.truncated).toBe(true);
  });

  it('ignores a slow, older response that arrives after a newer one', async () => {
    let resolveSlow!: (v: unknown) => void;
    fetchOrders.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r))); // request #1 (slow)
    const { result } = renderHook(() => useOrders());
    fetchOrders.mockResolvedValueOnce(ok([makeOrder({ customer: 'Baru' })])); // request #2 (fast)
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.orders.map((o) => o.customer)).toEqual(['Baru']);
    await act(async () => {
      resolveSlow(ok([makeOrder({ customer: 'Usang' })]));
    });
    expect(result.current.orders.map((o) => o.customer)).toEqual(['Baru']);
  });

  it('patchOrder updates one order in place', async () => {
    const o = makeOrder({ productionStatus: 'CUTTING' });
    fetchOrders.mockResolvedValue(ok([o, makeOrder()]));
    const { result } = renderHook(() => useOrders());
    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    act(() => result.current.patchOrder(o.orderId, { productionStatus: 'SEWING' }));
    expect(result.current.orders.find((x) => x.orderId === o.orderId)?.productionStatus).toBe('SEWING');
    expect(result.current.orders.filter((x) => x.productionStatus === 'SEWING')).toHaveLength(1);
  });

  it('polls while the tab is visible and pauses while it is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchOrders.mockResolvedValue(ok());
    renderHook(() => useOrders({ pollMs: 1000 }));
    await vi.advanceTimersByTimeAsync(10);
    const initial = fetchOrders.mock.calls.length;

    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchOrders.mock.calls.length).toBeGreaterThan(initial);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const whileHidden = fetchOrders.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3100);
    expect(fetchOrders.mock.calls.length).toBe(whileHidden);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('does not update state after unmount', async () => {
    let resolve!: (v: unknown) => void;
    fetchOrders.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useOrders());
    unmount();
    await act(async () => {
      resolve(ok());
    });
    expect(err).not.toHaveBeenCalled();
  });
});
