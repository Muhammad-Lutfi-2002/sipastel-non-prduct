import { useCallback, useEffect, useRef, useState } from 'react';
import { Order, ProductionLog } from '../types';
import { fetchOrderByOrderId, getOrderActivity } from '../utils/storage';

export interface UseOrderResult {
  order: Order | null;
  activity: ProductionLog[];
  isLoading: boolean;
  /** Set when the order could not be loaded (as opposed to not existing). */
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads one order plus its persistent activity log. */
export function useOrder(orderId: string): UseOrderResult {
  const [order, setOrder] = useState<Order | null>(null);
  const [activity, setActivity] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    const result = await fetchOrderByOrderId(orderId);
    if (requestId !== requestRef.current) return;

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }
    setError(null);
    setOrder(result.data);
    if (result.data) {
      const logs = await getOrderActivity(result.data.id);
      if (requestId !== requestRef.current) return;
      setActivity(logs);
    } else {
      setActivity([]);
    }
    setIsLoading(false);
  }, [orderId]);

  useEffect(() => {
    setIsLoading(true);
    void reload();
    return () => {
      requestRef.current += 1; // drop in-flight responses after unmount / id change
    };
  }, [reload]);

  return { order, activity, isLoading, error, reload };
}
