import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chain, mockSupabase, resetSupabaseMock } from '../test/supabaseMock';

vi.mock('../lib/supabaseClient', () => ({ supabase: mockSupabase }));

const reportToSentry = vi.fn();
vi.mock('../lib/sentry', () => ({ reportToSentry: (...a: unknown[]) => reportToSentry(...a) }));

import { logClientError, fetchRecentClientErrors } from './clientErrorLog';

beforeEach(() => {
  resetSupabaseMock();
  reportToSentry.mockClear();
});

describe('logClientError', () => {
  it('inserts a truncated, sanitised report and never throws even if the insert fails', async () => {
    const q = chain({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    await logClientError({ boundary: 'admin', message: 'x'.repeat(5000), stack: 'y'.repeat(5000) });
    const insertCall = q.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, string>;
    expect(payload.message.length).toBe(4000);
    expect(payload.stack.length).toBe(4000);
    expect(payload.boundary).toBe('admin');
  });

  it('swallows a failed insert silently (logging must never itself crash the app)', async () => {
    mockSupabase.from.mockImplementationOnce(() => {
      throw new Error('network down');
    });
    await expect(logClientError({ boundary: 'admin', message: 'x' })).resolves.toBeUndefined();
  });

  it('throttles to at most 5 reports per boundary so an error loop cannot flood the table', async () => {
    mockSupabase.from.mockReturnValue(chain({ data: null, error: null }));
    for (let i = 0; i < 8; i++) {
      await logClientError({ boundary: 'loop-test', message: `attempt ${i}` });
    }
    expect(mockSupabase.from).toHaveBeenCalledTimes(5);
  });

  it('also forwards every report to Sentry (a no-op there unless VITE_SENTRY_DSN is set)', async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
    await logClientError({ boundary: 'admin', message: 'boom', stack: 'at x.tsx:1' });
    expect(reportToSentry).toHaveBeenCalledWith({ message: 'boom', stack: 'at x.tsx:1' }, 'admin');
  });

  it('still forwards to Sentry even when the Supabase insert itself fails', async () => {
    mockSupabase.from.mockImplementationOnce(() => {
      throw new Error('network down');
    });
    await logClientError({ boundary: 'storefront', message: 'boom' });
    expect(reportToSentry).toHaveBeenCalledWith({ message: 'boom', stack: undefined }, 'storefront');
  });
});

describe('fetchRecentClientErrors', () => {
  it('maps rows to camelCase entries', async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [{ id: '1', boundary: 'admin', message: 'oops', page_path: '/admin/orders', created_at: '2026-09-21T00:00:00Z' }],
        error: null,
      })
    );
    const res = await fetchRecentClientErrors();
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: '1', boundary: 'admin', message: 'oops', pagePath: '/admin/orders', createdAt: '2026-09-21T00:00:00Z' }]);
  });

  it('reports a load failure instead of pretending there are no errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: { message: 'denied' } }));
    const res = await fetchRecentClientErrors();
    expect(res.data).toEqual([]);
    expect(res.error).toMatch(/tidak dapat memuat/i);
  });
});
