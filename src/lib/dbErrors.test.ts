import { describe, it, expect } from 'vitest';
import { friendlyDbError, toMutationResult } from './dbErrors';

describe('friendlyDbError', () => {
  it('maps RLS / permission errors', () => {
    expect(friendlyDbError({ code: '42501', message: 'x' })).toMatch(/tidak memiliki izin/);
    expect(friendlyDbError({ message: 'new row violates row-level security policy for table "orders"' })).toMatch(/izin/);
  });
  it('maps constraint errors without leaking raw SQL details', () => {
    expect(friendlyDbError({ code: '23505', message: 'duplicate key value violates unique constraint "orders_pkey"' })).not.toMatch(/orders_pkey/);
    expect(friendlyDbError({ code: '23514', message: 'check' })).toMatch(/validasi/);
    expect(friendlyDbError({ code: '23503', message: 'fk' })).toMatch(/terhubung/);
  });
  it('recognises network and expired-session failures', () => {
    expect(friendlyDbError({ message: 'TypeError: Failed to fetch' })).toMatch(/koneksi/i);
    expect(friendlyDbError({ message: 'JWT expired' })).toMatch(/login kembali/);
  });
  it('passes through deliberate business-rule messages (RAISE EXCEPTION)', () => {
    expect(friendlyDbError({ code: 'P0001', message: 'Tautan file desain tidak valid.' })).toBe('Tautan file desain tidak valid.');
  });
  it('has a safe default', () => {
    expect(friendlyDbError({ message: 'weird internal stack trace' })).toMatch(/kesalahan/);
    expect(friendlyDbError(null)).toMatch(/kesalahan/);
  });
});

describe('toMutationResult', () => {
  it('is a success when rows were affected', () => {
    expect(toMutationResult({ data: [{ id: 1 }], error: null })).toEqual({ success: true });
  });
  it('treats "0 rows affected" as a failure, not a silent success (RLS filtered the write)', () => {
    const res = toMutationResult({ data: [], error: null });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/izin/);
    expect(toMutationResult({ data: null, error: null }).success).toBe(false);
  });
  it('uses a custom not-found message when provided', () => {
    expect(toMutationResult({ data: [], error: null }, { notFoundMessage: 'Hanya Owner.' }).error).toBe('Hanya Owner.');
  });
  it('reports database errors in friendly form', () => {
    const res = toMutationResult({ data: null, error: { code: '42501', message: 'denied' } });
    expect(res).toMatchObject({ success: false });
    expect(res.error).toMatch(/izin/);
  });
});
