import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AdminUser } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  AuthSession,
  getStoredSession,
  authenticate,
  fetchStaffProfile,
  clearStoredSession,
} from '../services/authService';
import { checkRolePermission, Permission } from '../utils/permissions';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'expired';

interface AuthContextValue {
  authStatus: AuthStatus;
  user: AdminUser | null;
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  clearExpiredState: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// How often a returning tab re-checks that the staff account still exists
// and still has the same role (e.g. the Owner revoked access meanwhile).
const PROFILE_RECHECK_MS = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  // Refs let the long-lived auth listener see current values without
  // re-subscribing on every state change.
  const sessionRef = useRef<AuthSession | null>(null);
  const manualLogoutRef = useRef(false);
  const lastProfileCheckRef = useRef(0);
  sessionRef.current = session;

  // Initial session check on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getStoredSession();
      if (cancelled) return;
      lastProfileCheckRef.current = Date.now();
      if (active) {
        setSession(active);
        setAuthStatus('authenticated');
      } else {
        setSession(null);
        setAuthStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to real Supabase Auth session events (expiry, sign-out from
  // another tab, ...) instead of polling on a timer.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      // supabase-js holds an internal lock while it runs this callback, so
      // awaiting another supabase call *inside* it can deadlock. Hand the
      // work to a fresh task instead.
      window.setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
          const hadSession = sessionRef.current !== null;
          setSession(null);
          // A sign-out we did not ask for (token revoked / expired / signed
          // out in another tab) is reported as "expired" so the login page
          // can explain why the user was sent back.
          setAuthStatus(hadSession && !manualLogoutRef.current ? 'expired' : 'unauthenticated');
          manualLogoutRef.current = false;
          return;
        }

        // Token refreshes and the initial-session event carry no identity
        // change; the profile is already loaded by the mount effect above.
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
        if (!newSession?.user) return;

        // supabase-js re-emits SIGNED_IN when a tab regains focus - skip the
        // network round trip when nothing about the identity changed.
        if (event === 'SIGNED_IN' && sessionRef.current?.user.id === newSession.user.id) return;

        const profile = await fetchStaffProfile(newSession.user.id);
        if (!profile) {
          await supabase.auth.signOut();
          setSession(null);
          setAuthStatus('unauthenticated');
          return;
        }
        lastProfileCheckRef.current = Date.now();
        setSession({ user: profile });
        setAuthStatus('authenticated');
      }, 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Re-validate the staff profile when the user returns to the tab.
  useEffect(() => {
    const recheck = async () => {
      const current = sessionRef.current;
      if (document.visibilityState !== 'visible' || !current) return;
      if (Date.now() - lastProfileCheckRef.current < PROFILE_RECHECK_MS) return;
      lastProfileCheckRef.current = Date.now();

      const profile = await fetchStaffProfile(current.user.id);
      if (!profile) {
        // Access was revoked (or the lookup failed authoritatively).
        await supabase.auth.signOut();
        return;
      }
      if (profile.role !== current.user.role || profile.name !== current.user.name) {
        setSession({ user: profile });
      }
    };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authenticate(email, password);
    if (result.success && result.session) {
      manualLogoutRef.current = false;
      lastProfileCheckRef.current = Date.now();
      setSession(result.session);
      setAuthStatus('authenticated');
      return { success: true };
    }
    return { success: false, error: result.error || 'Email atau password salah.' };
  }, []);

  const logout = useCallback(async () => {
    manualLogoutRef.current = true;
    setSession(null);
    setAuthStatus('unauthenticated');
    try {
      await clearStoredSession();
    } catch (e) {
      console.error('Sign-out request failed:', e);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!session?.user) return false;
      return checkRolePermission(session.user.role, permission);
    },
    [session]
  );

  const clearExpiredState = useCallback(() => {
    setAuthStatus((current) => (current === 'expired' ? 'unauthenticated' : current));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authStatus,
        user: session?.user || null,
        session,
        login,
        logout,
        hasPermission,
        clearExpiredState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
