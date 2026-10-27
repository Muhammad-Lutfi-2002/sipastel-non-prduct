import { test, expect } from '@playwright/test';
import { mockBaseline, mockLogin, mockOrders, orderFixture, STAFF } from './mocks';

test('production head advances an order to the next stage', async ({ page }) => {
  await mockBaseline(page);
  await mockLogin(page, STAFF.production);
  const order = orderFixture({ production_status: 'CUTTING' });
  await mockOrders(page, [order]);

  await page.goto('/admin/login');
  await page.getByLabel(/^email$/i).fill(STAFF.production.email);
  await page.getByLabel(/^password/i).fill('correct-horse-1');
  await page.getByRole('button', { name: /^masuk/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.goto('/admin/production');
  await expect(page.getByText(order.customer)).toBeVisible();

  const advanceButton = page.getByRole('button', { name: /lanjut ke jahit/i });
  await expect(advanceButton).toBeVisible();
  await advanceButton.click();

  await expect(page.getByText(/dipindahkan ke/i)).toBeVisible({ timeout: 10_000 });
});
