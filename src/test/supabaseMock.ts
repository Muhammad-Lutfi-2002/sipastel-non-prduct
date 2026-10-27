import { vi } from 'vitest';

export type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

/** A chainable stand-in for a supabase-js query builder that resolves to `result`. */
export function chain(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const c: Record<string, unknown> = {};
  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return c;
    };
  for (const m of ['select', 'update', 'insert', 'delete', 'eq', 'order', 'limit', 'gte', 'in']) {
    c[m] = record(m);
  }
  c.single = () => Promise.resolve(result);
  c.maybeSingle = () => Promise.resolve(result);
  c.then = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  c.calls = calls;
  return c as typeof c & { calls: typeof calls };
}

export const storageBucket = {
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
};

export const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn(() => storageBucket) },
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
};

export function resetSupabaseMock() {
  mockSupabase.from.mockReset();
  mockSupabase.rpc.mockReset();
  storageBucket.upload.mockReset();
  storageBucket.remove.mockReset().mockResolvedValue({ data: [], error: null });
  storageBucket.getPublicUrl.mockReset();
}
