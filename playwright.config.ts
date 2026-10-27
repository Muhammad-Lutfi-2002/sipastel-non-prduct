import { defineConfig, devices } from '@playwright/test';

// Entirely separate from Vitest: lives in its own directory with its own
// *.spec.ts extension, so `npm test` (vitest) and `npm run test:e2e`
// (this) never pick up each other's files.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Runs against a real production build (`vite preview`), not the dev
  // server - closer to what actually ships, and it's what "e2e" should mean.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // A syntactically valid but fake project: every test that touches
      // Supabase mocks the network with page.route(), so nothing here ever
      // needs to be a real, working backend.
      VITE_SUPABASE_URL: 'https://e2e-test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-test-anon-key',
      VITE_WHATSAPP_NUMBER: '6281234567890',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
