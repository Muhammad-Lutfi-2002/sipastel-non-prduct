import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { canAccessRoute, homeRouteForRole } from '../../utils/permissions';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminLayout } from './AdminLayout';
import { AccessDenied } from './AccessDenied';
import { DashboardView } from './views/DashboardView';
import { OrdersView } from './views/OrdersView';
import { OrderDetailView } from './views/OrderDetailView';
import { ProductionView } from './views/ProductionView';
import { ProductsView } from './views/ProductsView';
import { CustomersView } from './views/CustomersView';
import { InvoicesView } from './views/InvoicesView';
import { SettingsView } from './views/SettingsView';

/** Only allow post-login redirects to another admin page of this app. */
export function sanitizeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/admin') || next.startsWith('//') || next.startsWith('/admin/login')) return null;
  return next;
}

export const AdminRoutes: React.FC = () => {
  const { authStatus, user } = useAuth();
  const { pathname, search, searchParams, navigate } = useRouter();

  const isLoginPage = pathname === '/admin/login';

  // Strict route protection
  useEffect(() => {
    if (authStatus === 'loading') return;

    if (authStatus !== 'authenticated') {
      if (!isLoginPage) {
        // Remember where the user was going so login can send them back.
        const target = `${pathname}${search}`;
        const next = sanitizeNextPath(target);
        navigate(next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login', { replace: true });
      }
    } else if (isLoginPage) {
      const next = sanitizeNextPath(searchParams.get('next'));
      const destination = next && canAccessRoute(user?.role, next) ? next : homeRouteForRole(user?.role);
      navigate(destination, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, isLoginPage, user?.role]);

  // Loading state
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center text-ink" role="status">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
        <p className="font-heading font-bold text-sm tracking-wider uppercase mt-4">SIPASTEL STUDIO</p>
        <p className="text-xs text-muted font-mono mt-1">Memverifikasi sesi login studio...</p>
      </div>
    );
  }

  // If not authenticated, always show Login Page
  if (authStatus !== 'authenticated') {
    return <AdminLoginPage />;
  }

  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  // Authorization: a role that may not use a page never sees its content,
  // even when the URL is typed in by hand. (Database RLS is the real
  // boundary - this keeps the UI honest and consistent with it.)
  if (!canAccessRoute(user?.role, cleanPath)) {
    return (
      <AdminLayout>
        <AccessDenied />
      </AdminLayout>
    );
  }

  // Parse dynamic order ID: /admin/orders/[orderId]
  const orderDetailMatch = cleanPath.match(/^\/admin\/orders\/([^/]+)$/);
  if (orderDetailMatch) {
    let orderId = orderDetailMatch[1];
    try {
      orderId = decodeURIComponent(orderId);
    } catch {
      /* keep raw */
    }
    return (
      <AdminLayout>
        <OrderDetailView key={orderId} orderId={orderId} />
      </AdminLayout>
    );
  }

  let view: React.ReactNode;
  switch (cleanPath) {
    case '/admin/orders':
      view = <OrdersView />;
      break;
    case '/admin/production':
      view = <ProductionView />;
      break;
    case '/admin/products':
      view = <ProductsView />;
      break;
    case '/admin/customers':
      view = <CustomersView />;
      break;
    case '/admin/invoices':
      view = <InvoicesView />;
      break;
    case '/admin/settings':
      view = <SettingsView />;
      break;
    case '/admin':
    case '/admin/dashboard':
    default:
      // Unknown /admin/* routes land on the dashboard.
      view = <DashboardView />;
  }

  return <AdminLayout>{view}</AdminLayout>;
};
