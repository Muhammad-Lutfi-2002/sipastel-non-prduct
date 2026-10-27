import { describe, it, expect } from 'vitest';
import { checkRolePermission, canAccessRoute, homeRouteForRole, permissionForRoute } from './permissions';

describe('checkRolePermission', () => {
  it('OWNER can do everything', () => {
    expect(checkRolePermission('OWNER', 'payments:void')).toBe(true);
    expect(checkRolePermission('OWNER', 'settings:write')).toBe(true);
  });
  it('FINANCE handles money but not production', () => {
    expect(checkRolePermission('FINANCE', 'orders:write:payment')).toBe(true);
    expect(checkRolePermission('FINANCE', 'orders:write:price')).toBe(true);
    expect(checkRolePermission('FINANCE', 'production:write')).toBe(false);
    expect(checkRolePermission('FINANCE', 'payments:void')).toBe(false);
    expect(checkRolePermission('FINANCE', 'products:write')).toBe(false);
  });
  it('PRODUCTION_HEAD handles the workshop but not money', () => {
    expect(checkRolePermission('PRODUCTION_HEAD', 'production:write')).toBe(true);
    expect(checkRolePermission('PRODUCTION_HEAD', 'products:write')).toBe(true);
    expect(checkRolePermission('PRODUCTION_HEAD', 'finance:read')).toBe(false);
    expect(checkRolePermission('PRODUCTION_HEAD', 'invoices:read')).toBe(false);
    expect(checkRolePermission('PRODUCTION_HEAD', 'orders:write:price')).toBe(false);
  });
  it('only the OWNER may edit studio settings', () => {
    expect(checkRolePermission('FINANCE', 'settings:write')).toBe(false);
    expect(checkRolePermission('PRODUCTION_HEAD', 'settings:write')).toBe(false);
  });
  it('denies when there is no role', () => {
    expect(checkRolePermission(undefined, 'dashboard:read')).toBe(false);
    expect(checkRolePermission(null, 'dashboard:read')).toBe(false);
  });
});

describe('route access', () => {
  it('maps routes to permissions (ignoring query strings and trailing slashes)', () => {
    expect(permissionForRoute('/admin/production?stage=qc')).toBe('production:read');
    expect(permissionForRoute('/admin/orders/SPS-1/')).toBe('orders:read');
    expect(permissionForRoute('/admin/unknown')).toBeNull();
  });
  it('blocks each role from the pages it should not see', () => {
    expect(canAccessRoute('FINANCE', '/admin/production')).toBe(false);
    expect(canAccessRoute('FINANCE', '/admin/invoices')).toBe(true);
    expect(canAccessRoute('PRODUCTION_HEAD', '/admin/customers')).toBe(false);
    expect(canAccessRoute('PRODUCTION_HEAD', '/admin/invoices')).toBe(false);
    expect(canAccessRoute('PRODUCTION_HEAD', '/admin/production')).toBe(true);
    expect(canAccessRoute('OWNER', '/admin/customers')).toBe(true);
    expect(canAccessRoute(undefined, '/admin/dashboard')).toBe(false);
  });
  it('everyone lands somewhere they may open', () => {
    for (const role of ['OWNER', 'FINANCE', 'PRODUCTION_HEAD'] as const) {
      expect(canAccessRoute(role, homeRouteForRole(role))).toBe(true);
    }
  });
});
