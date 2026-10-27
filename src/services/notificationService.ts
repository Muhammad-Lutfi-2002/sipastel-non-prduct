import { AdminNotification } from '../types';
import { supabase } from '../lib/supabaseClient';
import { friendlyDbError, toMutationResult, MutationResult } from '../lib/dbErrors';

// Real notifications backed by the `notifications` table in Supabase.
// Rows are created automatically by database triggers whenever a new order
// comes in, a payment is recorded, or an order's production/shipping status
// changes (see the trg_notify_* triggers) - this service only ever reads
// and marks rows as read, it never fabricates notification content.

function rowToNotification(row: Record<string, unknown>): AdminNotification {
  return {
    id: row.id as string,
    message: row.message as string,
    category: row.category as AdminNotification['category'],
    orderId: (row.order_id as string) ?? undefined,
    createdAt: row.created_at as string,
    isRead: Boolean(row.is_read),
  };
}

export async function fetchNotifications(): Promise<{ data: AdminNotification[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to load notifications from Supabase:', error.message);
    return { data: [], error: friendlyDbError(error) };
  }
  return { data: (data ?? []).map(rowToNotification), error: null };
}

export async function getStoredNotifications(): Promise<AdminNotification[]> {
  return (await fetchNotifications()).data;
}

export async function markNotificationAsRead(id: string): Promise<MutationResult> {
  const response = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select('id');
  return toMutationResult(response);
}

export async function markAllNotificationsAsRead(): Promise<MutationResult> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) {
    console.error('Failed to mark all notifications as read in Supabase:', error.message);
    return { success: false, error: friendlyDbError(error) };
  }
  return { success: true };
}
