import type { Page } from '@playwright/test';

// Shared Supabase REST/Auth mocking for the E2E suite. Every test intercepts
// the network instead of hitting a real project - deterministic, doesn't
// need real credentials, and never touches production data.
const SUPABASE_URL = 'https://e2e-test-project.supabase.co';

export const STAFF = {
  owner: { id: '00000000-0000-0000-0000-00000000000a', name: 'Owner Test', email: 'owner@sipastel.test', role: 'OWNER' },
  finance: { id: '00000000-0000-0000-0000-00000000000b', name: 'Finance Test', email: 'finance@sipastel.test', role: 'FINANCE' },
  production: { id: '00000000-0000-0000-0000-00000000000c', name: 'Produksi Test', email: 'produksi@sipastel.test', role: 'PRODUCTION_HEAD' },
};

export function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

const PRODUCT = {
  id: 'prod-e2e-1',
  slug: 'kaos-e2e',
  name: 'Kaos E2E Test',
  category: 'KAOS',
  price: 125000,
  short_description: 'Kaos katun untuk pengujian.',
  description: '',
  material: 'Katun Combed 24s',
  fit: 'Regular',
  production_time: '3-5 hari',
  care_instructions: [],
  sizes: ['S', 'M', 'L'],
  colors: [{ name: 'Hitam', hex: '#111111' }],
  images: [],
  in_stock: true,
  is_best_seller: false,
  is_new: true,
};

const STUDIO_PROFILE = {
  name: 'SIPASTEL APPAREL STUDIO',
  address: 'Jl. Uji Coba No. 1, Bogor',
  phone: '0896-7734-3212',
  bank_name: 'BCA',
  bank_account_number: '1234567890',
  bank_account_holder: 'SIPASTEL',
  logo_url: null,
};

/** Base mocks every test needs: catalog + studio profile, empty/no-op by default for everything else. */
export async function mockBaseline(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/products*`, (route) => route.fulfill(json([PRODUCT])));
  await page.route(`${SUPABASE_URL}/rest/v1/studio_profile*`, (route) => route.fulfill(json(STUDIO_PROFILE)));
  await page.route(`${SUPABASE_URL}/rest/v1/notifications*`, (route) => route.fulfill(json([])));
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, (route) => route.fulfill(json({ error: 'no session' }, 401)));
  // No active session by default (getSession reads localStorage first, but
  // fulfils cheaply if supabase-js probes the network too).
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, (route) => route.fulfill(json({ error: 'invalid_grant' }, 400)));
}

/** Signs a role in: mocks the password grant + the staff_profiles lookup it triggers. */
export async function mockLogin(page: Page, staff: (typeof STAFF)[keyof typeof STAFF], password = 'correct-horse-1') {
  await page.route(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, async (route) => {
    const body = route.request().postDataJSON() as { password?: string };
    if (body.password !== password) {
      return route.fulfill(json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400));
    }
    return route.fulfill(
      json({
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: staff.id, email: staff.email, app_metadata: {}, user_metadata: {} },
      })
    );
  });
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, (route) =>
    route.fulfill(json({ id: staff.id, email: staff.email, app_metadata: {}, user_metadata: {} }))
  );
  await page.route(`${SUPABASE_URL}/rest/v1/staff_profiles*`, (route) =>
    route.fulfill(json([{ id: staff.id, name: staff.name, email: staff.email, role: staff.role }]))
  );
}

export async function mockOrders(page: Page, orders: Record<string, unknown>[]) {
  await page.route(`${SUPABASE_URL}/rest/v1/orders*`, async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill(json(orders[0] ?? {}, 201));
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill(json(orders, 200));
    }
    return route.fulfill(json(orders));
  });
}

export function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-e2e-1',
    order_id: 'SPS-20260921-E2E001',
    customer: 'Dimas E2E',
    phone: '0812-3456-7890',
    email: null,
    address: 'Jl. Merdeka 1',
    city: 'Bogor',
    postal_code: '16111',
    items: [{ productId: 'prod-e2e-1', productName: 'Kaos E2E Test — Hitam', category: 'KAOS', size: 'M', color: 'Hitam', quantity: 1 }],
    quantity: 1,
    total_price: 125000,
    total_paid: 0,
    remaining_balance: 125000,
    payment_percentage: 0,
    design_url: null,
    design_file_name: null,
    notes: null,
    payment_status: 'BELUM_BAYAR',
    production_status: 'CUTTING',
    shipping_status: 'NOT_SHIPPED',
    courier: null,
    tracking_number: null,
    invoice_number: 'INV-E2E-001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_custom_order: true,
    invoices: [{ id: 'invoice-e2e-1' }],
    ...overrides,
  };
}
