import { test, expect } from '@playwright/test';
import { mockBaseline } from './mocks';

// Documents the SITE'S CURRENT actual behaviour: "/" redirects to the admin
// console, so an anonymous visitor lands on the staff login screen rather
// than a storefront or landing page. This was flagged in the front-end
// review as almost certainly not what should ship long-term - this test
// exists so that whichever way it's resolved, the change is a deliberate,
// visible diff here rather than a silent regression either direction.
test('root path currently shows the admin login screen for anonymous visitors', async ({ page }) => {
  await mockBaseline(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: /sipastel/i }).first()).toBeVisible();
  await expect(page.getByLabel(/^email$/i)).toBeVisible();
});

test('the public custom-order form is reachable directly by URL', async ({ page }) => {
  await mockBaseline(page);
  await page.goto('/custom-order');
  await expect(page).toHaveURL(/\/custom-order$/);
  await expect(page.getByPlaceholder('Contoh: Dimas Aditya')).toBeVisible();
});
