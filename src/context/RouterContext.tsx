import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface RouterContextValue {
  /** Path only, never includes the query string (e.g. "/admin/orders"). */
  pathname: string;
  /** Raw query string including the leading "?" (or "" when absent). */
  search: string;
  searchParams: URLSearchParams;
  navigate: (path: string, options?: { replace?: boolean; scroll?: boolean }) => void;
  isAdminRoute: boolean;
}

interface LocationState {
  pathname: string;
  search: string;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

const DEFAULT_HOME = '/admin/production';

// The public retail catalog is intentionally hidden for now: the root and
// /shop URLs land on the studio Production Board instead.
function isHiddenStorefrontPath(path: string): boolean {
  return path === '/' || path === '' || path === '/shop';
}

function readLocation(): LocationState {
  if (typeof window === 'undefined') return { pathname: DEFAULT_HOME, search: '' };
  const path = window.location.pathname || '/';
  if (isHiddenStorefrontPath(path)) return { pathname: DEFAULT_HOME, search: '' };
  return { pathname: path, search: window.location.search || '' };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<LocationState>(readLocation);

  useEffect(() => {
    // Keep the address bar consistent with the redirect applied on first load.
    if (typeof window !== 'undefined' && isHiddenStorefrontPath(window.location.pathname || '/')) {
      window.history.replaceState({}, '', DEFAULT_HOME);
    }
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean; scroll?: boolean }) => {
    if (typeof window === 'undefined') return;

    let target: URL;
    try {
      target = new URL(to, window.location.origin);
    } catch {
      return;
    }
    // Only ever navigate inside this app.
    if (target.origin !== window.location.origin) return;

    const path = isHiddenStorefrontPath(target.pathname) ? DEFAULT_HOME : target.pathname;
    const search = isHiddenStorefrontPath(target.pathname) ? '' : target.search;
    const nextUrl = `${path}${search}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      if (options?.replace) {
        window.history.replaceState({}, '', nextUrl);
      } else {
        window.history.pushState({}, '', nextUrl);
      }
    }
    setLocation({ pathname: path, search });
    // Switching a filter tab on the same page should not jump back to the top.
    if (options?.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname: location.pathname,
      search: location.search,
      searchParams: new URLSearchParams(location.search),
      navigate,
      isAdminRoute: location.pathname.startsWith('/admin'),
    }),
    [location, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
