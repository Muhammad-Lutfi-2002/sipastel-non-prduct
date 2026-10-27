import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { chain, mockSupabase, resetSupabaseMock } from '../test/supabaseMock';

vi.mock('../lib/supabaseClient', () => ({ supabase: mockSupabase }));

import { AuthProvider, useAuth } from './AuthContext';
import { authenticate, changeOwnPassword, fetchStaffProfile } from '../services/authService';

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;
let authCallback: AuthCallback | null = null;

const staffRow = (role: string, id = 'u1') => ({ id, name: 'Rina Staff', email: 'rina@sipastel.test', role });
const profileQuery = (row: unknown) => chain({ data: row, error: null });

let auth: ReturnType<typeof useAuth>;
const Probe: React.FC = () => {
  auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.authStatus}</span>
      <span data-testid="role">{auth.user?.role ?? 'none'}</span>
    </div>
  );
};
const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  resetSupabaseMock();
  mockSupabase.auth.signInWithPassword.mockReset();
  mockSupabase.auth.signOut.mockReset().mockResolvedValue({ error: null });
  mockSupabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  mockSupabase.auth.updateUser.mockReset();
  authCallback = null;
  mockSupabase.auth.onAuthStateChange.mockImplementation(((cb: AuthCallback) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }) as never);
});

describe('authenticate()', () => {
  it('sends the password untouched and lower-cases/trims only the email', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('OWNER')));
    const res = await authenticate('  Owner@Sipastel.COM ', '  s3cret  ');
    expect(res.success).toBe(true);
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@sipastel.com', password: '  s3cret  ' });
  });

  it('uses one message for a wrong email and a wrong password (no account enumeration)', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const res = await authenticate('a@b.co', 'x');
    expect(res).toEqual({ success: false, error: 'Email atau password salah.' });
  });

  it('validates input before contacting Supabase', async () => {
    expect((await authenticate('', 'x')).success).toBe(false);
    expect((await authenticate('not-an-email', 'x')).error).toMatch(/format email/i);
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs a user OUT again when their account is not provisioned as staff', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'stranger' } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(null));
    const res = await authenticate('x@y.co', 'pw');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/belum diberi akses/i);
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('refuses a role this build does not know about (no silent privilege)', async () => {
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('SUPER_ADMIN')));
    expect(await fetchStaffProfile('u1')).toBeNull();
  });
});

describe('changeOwnPassword()', () => {
  it('enforces a minimum length and a different password', async () => {
    expect((await changeOwnPassword('a@b.co', 'old', 'short')).error).toMatch(/minimal 10/);
    expect((await changeOwnPassword('a@b.co', 'samesamesame', 'samesamesame')).error).toMatch(/berbeda/);
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('re-verifies the current password before changing it', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'bad' } });
    const res = await changeOwnPassword('a@b.co', 'wrongold', 'a-brand-new-password');
    expect(res).toEqual({ success: false, error: 'Password saat ini salah.' });
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('updates the password once verified', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSupabase.auth.updateUser.mockResolvedValue({ error: null });
    expect(await changeOwnPassword('a@b.co', 'oldpassword1', 'a-brand-new-password')).toEqual({ success: true });
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'a-brand-new-password' });
  });
});

describe('AuthProvider', () => {
  it('starts unauthenticated when there is no session', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
  });

  it('restores an existing session with the staff role', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('FINANCE')));
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('role').textContent).toBe('FINANCE');
    expect(auth.hasPermission('orders:write:payment')).toBe(true);
    expect(auth.hasPermission('production:write')).toBe(false);
  });

  it('reports an unexpected sign-out (revoked/expired session) as "expired", not a normal logout', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('OWNER')));
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('status').textContent).toBe('expired');
    act(() => auth.clearExpiredState());
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('a deliberate logout ends as "unauthenticated" and calls Supabase signOut', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('OWNER')));
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    await act(async () => {
      await auth.logout();
    });
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('does not re-query the staff profile on token refresh or a repeated SIGNED_IN', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    mockSupabase.from.mockReturnValue(profileQuery(staffRow('OWNER')));
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    const callsBefore = mockSupabase.from.mock.calls.length;
    await act(async () => {
      authCallback?.('TOKEN_REFRESHED', { user: { id: 'u1' } });
      authCallback?.('SIGNED_IN', { user: { id: 'u1' } });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockSupabase.from.mock.calls.length).toBe(callsBefore);
  });

  it('login() success flips to authenticated and exposes the role', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u9' } }, error: null });
    mockSupabase.from.mockReturnValueOnce(profileQuery(staffRow('PRODUCTION_HEAD', 'u9')));
    let result: { success: boolean } | undefined;
    await act(async () => {
      result = await auth.login('kepala@sipastel.test', 'pw');
    });
    expect(result?.success).toBe(true);
    expect(screen.getByTestId('role').textContent).toBe('PRODUCTION_HEAD');
  });

  it('subscribes to auth events once and cleans up', async () => {
    const unsubscribe = vi.fn();
    mockSupabase.auth.onAuthStateChange.mockImplementation((() => ({ data: { subscription: { unsubscribe } } })) as never);
    const { unmount } = mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
