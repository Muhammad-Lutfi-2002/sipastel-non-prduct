import { test, expect } from '@playwright/test';
import { mockBaseline, mockLogin, mockOrders, orderFixture, STAFF } from './mocks';

test.describe('Admin authentication', () => {
  test('visiting a protected page while logged out redirects to login and remembers the destination', async ({ page }) => {
    await mockBaseline(page);
    await page.goto('/admin/orders?status=new');
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
  });

  test('wrong password shows an error and does not navigate away from login', async ({ page }) => {
    await mockBaseline(page);
    await mockLogin(page, STAFF.owner);
    await page.goto('/admin/login');
    await page.getByLabel(/^email$/i).fill(STAFF.owner.email);
    await page.getByLabel(/^password/i).fill('the-wrong-password');
    await page.getByRole('button', { name: /^masuk/i }).click();
    await expect(page.getByText(/email atau password salah/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('correct credentials sign in and land on the dashboard', async ({ page }) => {
    await mockBaseline(page);
    await mockLogin(page, STAFF.owner);
    await mockOrders(page, [orderFixture()]);
    await page.goto('/admin/login');
    await page.getByLabel(/^email$/i).fill(STAFF.owner.email);
    await page.getByLabel(/^password/i).fill('correct-horse-1');
    await page.getByRole('button', { name: /^masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.getByText(/rina|owner test/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Role-based route authorization', () => {
  test('FINANCE cannot open the Production board', async ({ page }) => {
    await mockBaseline(page);
    await mockLogin(page, STAFF.finance);
    await mockOrders(page, []);
    await page.goto('/admin/login');
    await page.getByLabel(/^email$/i).fill(STAFF.finance.email);
    await page.getByLabel(/^password/i).fill('correct-horse-1');
    await page.getByRole('button', { name: /^masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    await page.goto('/admin/production');
    await expect(page.getByText('Akses Ditolak')).toBeVisible();
  });

  test('PRODUCTION_HEAD cannot open Invoices', async ({ page }) => {
    await mockBaseline(page);
    await mockLogin(page, STAFF.production);
    await mockOrders(page, []);
    await page.goto('/admin/login');
    await page.getByLabel(/^email$/i).fill(STAFF.production.email);
    await page.getByLabel(/^password/i).fill('correct-horse-1');
    await page.getByRole('button', { name: /^masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    await page.goto('/admin/invoices');
    await expect(page.getByText('Akses Ditolak')).toBeVisible();
  });
});
