import { supabase } from '../lib/supabaseClient';
import { AdminUser, AdminRole } from '../types';

export interface AuthSession {
  user: AdminUser;
}

const VALID_ROLES: AdminRole[] = ['OWNER', 'ADMIN', 'FINANCE', 'PRODUCTION_HEAD', 'MARKETING', 'INVESTOR'];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (VALID_ROLES as string[]).includes(value);
}

// Simple, permissive shape check - real validation is done by Supabase Auth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Real authentication backed by Supabase Auth. Credentials are verified
 * server-side by Supabase (password hashing, session issuance) - the client
 * never sees or compares password hashes itself. Row Level Security on every
 * table enforces access control based on the signed-in user, so even a
 * tampered client can't grant itself extra privileges.
 */
export async function authenticate(
  email: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !password) {
    return { success: false, error: 'Email dan password wajib diisi.' };
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return { success: false, error: 'Format email tidak valid.' };
  }

  // NOTE: the password is deliberately sent exactly as typed. Trimming it
  // would silently change credentials for anyone whose password starts or
  // ends with a space.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error || !data.user) {
    // Same message whether the email or the password was wrong, so failed
    // attempts don't reveal which accounts exist.
    return { success: false, error: 'Email atau password salah.' };
  }

  const profile = await fetchStaffProfile(data.user.id);
  if (!profile) {
    // A Supabase Auth user exists but has no (valid) staff_profiles row -
    // this account isn't provisioned as studio staff, so deny access and
    // sign them back out rather than leaving a half-authenticated session.
    await supabase.auth.signOut();
    return { success: false, error: 'Akun ini belum diberi akses ke konsol studio.' };
  }

  return { success: true, session: { user: profile } };
}

export async function fetchStaffProfile(userId: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, name, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  // A role this build doesn't know about must never silently gain access.
  if (!isAdminRole(data.role)) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
  };
}

/**
 * Reads the current Supabase Auth session (if any) and resolves it to a
 * studio staff profile. Returns null whenever there is no valid session or
 * the signed-in account isn't a provisioned staff member.
 */
export async function getStoredSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  const profile = await fetchStaffProfile(data.session.user.id);
  if (!profile) return null;

  return { user: profile };
}

export async function clearStoredSession(): Promise<void> {
  await supabase.auth.signOut();
}

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Lets a signed-in staff member rotate their own password. The current
 * password is re-verified first so a hijacked/unattended session alone is
 * not enough to take over the account.
 */
export async function changeOwnPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.` };
  }
  if (newPassword === currentPassword) {
    return { success: false, error: 'Password baru harus berbeda dari password saat ini.' };
  }

  const verify = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verify.error) {
    return { success: false, error: 'Password saat ini salah.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: error.message || 'Gagal mengubah password.' };
  }
  return { success: true };
}

export { ROLE_PERMISSIONS, checkRolePermission } from '../utils/permissions';
