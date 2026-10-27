import { test, expect } from '@playwright/test';
import { mockBaseline, mockOrders, orderFixture } from './mocks';

test.describe('Custom order form (public, unauthenticated)', () => {
  test('blocks submission with empty required fields and shows Indonesian errors', async ({ page }) => {
    await mockBaseline(page);
    await page.goto('/custom-order');
    await page.getByRole('button', { name: /lanjut/i }).click();
    await expect(page.getByText('Nama wajib diisi.')).toBeVisible();
  });

  test('completes all 7 steps and submits successfully', async ({ page }) => {
    await mockBaseline(page);
    await mockOrders(page, [orderFixture()]);

    await page.goto('/custom-order');

    // Step 1: contact
    await page.getByPlaceholder('Contoh: Dimas Aditya').fill('Dimas E2E');
    await page.getByPlaceholder('Contoh: 081234567890').fill('0812-3456-7890');
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 2: product
    await expect(page.getByText(/langkah 02 dari 07/i)).toBeVisible();
    await page.getByText('Kaos E2E Test').click();
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 3: specs (usable defaults) -> continue
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 4: design upload - optional, skip straight through
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 5: design description
    await page.getByPlaceholder(/sablon logo di dada kiri/i).fill('Logo di dada kiri, warna putih.');
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 6: shipping
    await page.getByPlaceholder(/nama jalan, nomor rumah/i).fill('Jl. Merdeka No. 10');
    await page.getByPlaceholder('Contoh: Bogor').fill('Bogor');
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 7: payment preference + review + submit
    await page.getByRole('button', { name: /dp \(uang muka\)/i }).click();
    await page.getByRole('button', { name: '30%' }).click();
    await page.locator('#submit-custom-order-btn').click();

    await expect(page.getByText(/berhasil|terkirim|diterima/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows a specific error (not a generic failure) when the order insert is rejected', async ({ page }) => {
    await mockBaseline(page);
    await page.route('https://e2e-test-project.supabase.co/rest/v1/orders*', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'new row violates row-level security policy' }),
      })
    );

    await page.goto('/custom-order');
    await page.getByPlaceholder('Contoh: Dimas Aditya').fill('Dimas E2E');
    await page.getByPlaceholder('Contoh: 081234567890').fill('0812-3456-7890');
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByText('Kaos E2E Test').click();
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByPlaceholder(/sablon logo di dada kiri/i).fill('Logo di dada kiri.');
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByPlaceholder(/nama jalan, nomor rumah/i).fill('Jl. Merdeka No. 10');
    await page.getByPlaceholder('Contoh: Bogor').fill('Bogor');
    await page.getByRole('button', { name: /lanjut/i }).click();
    await page.getByRole('button', { name: /dp \(uang muka\)/i }).click();
    await page.getByRole('button', { name: '30%' }).click();
    await page.locator('#submit-custom-order-btn').click();

    await expect(page.getByText(/gagal mengirim pesanan/i)).toBeVisible();
  });
});
