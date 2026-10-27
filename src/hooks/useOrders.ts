import { useCallback, useEffect, useRef, useState } from 'react';
import { Order } from '../types';
import { fetchOrders } from '../utils/storage';

interface UseOrdersOptions {
  /** Re-fetch every N ms while the tab is visible. Omit to disable polling. */
  pollMs?: number;
}

export interface UseOrdersResult {
  orders: Order[];
  /** True only for the very first load (drives skeletons). */
  isLoading: boolean;
  /** True during any background/manual refresh. */
  isRefreshing: boolean;
  /** Non-null when the LAST request failed; previously loaded orders are kept. */
  error: string | null;
  /** True when the row cap was hit and older orders are not shown. */
  truncated: boolean;
  /** Re-fetches; resolves true on success. */
  refresh: () => Promise<boolean>;
  /** Optimistically patch one order in place (by human-readable order id). */
  patchOrder: (orderId: string, patch: Partial<Order>) => void;
}

/**
 * Single source of truth for "load the orders" across the admin console.
 * Unlike the old per-view `getStoredOrders().then(setOrders)`:
 *  - a failed request is reported, not shown as an empty business,
 *  - a failed refresh keeps the data that is already on screen,
 *  - out-of-order responses can never overwrite newer ones,
 *  - polling pauses while the tab is hidden.
 */
export function useOrders(options: UseOrdersOptions = {}): UseOrdersResult {
  const { pollMs } = options;
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<boolean> => {
    const requestId = ++requestIdRef.current;
    setIsRefreshing(true);
    const result = await fetchOrders();
    // Ignore stale responses and responses arriving after unmount.
    if (!mountedRef.current || requestId !== requestIdRef.current) return !result.error;

    if (result.error) {
      setError(result.error);
    } else {
      setOrders(result.data);
      setTruncated(result.truncated);
      setError(null);
    }
    setIsLoading(false);
    setIsRefreshing(false);
    return !result.error;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = window.setInterval(tick, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  const patchOrder = useCallback((orderId: string, patch: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, ...patch } : o)));
  }, []);

  return { orders, isLoading, isRefreshing, error, truncated, refresh, patchOrder };
}
