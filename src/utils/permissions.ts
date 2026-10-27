// Role-based access control (client side).
//
// IMPORTANT: this is a *usability* layer - it hides controls and blocks
// routes a role should not use. It is NOT the security boundary. Every
// permission below must also be enforced by Row Level Security in the
// database (see supabase/migrations), because anyone can call the Supabase
// API directly with their own session token.

import type { AdminRole } from '../types';

export type Permission =
  | 'dashboard:read'
  | 'orders:read'
  | 'orders:write:price'
  | 'orders:write:payment'
  | 'payments:void'
  | 'production:read'
  | 'production:write'
  | 'shipping:read'
  | 'shipping:write'
  | 'products:read'
  | 'products:write'
  | 'customers:read'
  | 'invoices:read'
  | 'invoices:write'
  | 'finance:read'
  | 'settings:read'
  | 'settings:write';

export const ROLE_PERMISSIONS: Record<AdminRole, Array<Permission | '*'>> = {
  OWNER: ['*'],
  ADMIN: ['*'],
  FINANCE: [
    'dashboard:read',
    'orders:read',
    'orders:write:price',
    'orders:write:payment',
    'products:read',
    'customers:read',
    'invoices:read',
    'invoices:write',
    'finance:read',
    'settings:read',
  ],
  PRODUCTION_HEAD: [
    'dashboard:read',
    'orders:read',
    'production:read',
    'production:write',
    'shipping:read',
    'shipping:write',
    'products:read',
    'products:write',
    'settings:read',
  ],
  MARKETING: ['products:read', 'products:write', 'settings:read'],
  INVESTOR: [
    'dashboard:read',
    'orders:read',
    'production:read',
    'invoices:read',
    'finance:read',
  ],
};

export function checkRolePermission(role: AdminRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes('*') || perms.includes(permission);
}

/** Which permission is required to open each admin route. */
const ROUTE_PERMISSIONS: Array<{ match: (path: string) => boolean; permission: Permission }> = [
  { match: (p) => p === '/admin' || p === '/admin/dashboard', permission: 'dashboard:read' },
  { match: (p) => p === '/admin/orders' || p.startsWith('/admin/orders/'), permission: 'orders:read' },
  { match: (p) => p === '/admin/production', permission: 'production:read' },
  { match: (p) => p === '/admin/products', permission: 'products:read' },
  { match: (p) => p === '/admin/customers', permission: 'customers:read' },
  { match: (p) => p === '/admin/invoices', permission: 'invoices:read' },
  { match: (p) => p === '/admin/settings', permission: 'settings:read' },
];

export function permissionForRoute(path: string): Permission | null {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return ROUTE_PERMISSIONS.find((r) => r.match(clean))?.permission ?? null;
}

export function canAccessRoute(role: AdminRole | undefined | null, path: string): boolean {
  const needed = permissionForRoute(path);
  // Unknown admin paths fall through to the dashboard, which every role can open.
  if (!needed) return true;
  return checkRolePermission(role, needed);
}

/** First page a role is allowed to land on. */
export function homeRouteForRole(role: AdminRole | undefined | null): string {
  if (canAccessRoute(role, '/admin/dashboard')) return '/admin/dashboard';
  if (canAccessRoute(role, '/admin/orders')) return '/admin/orders';
  return '/admin/settings';
}
