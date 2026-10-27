import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Supabase env vars are required at import time by lib/supabaseClient.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

afterEach(() => {
  cleanup();
});

// jsdom does not implement these; several components call them.
if (!window.scrollTo) {
  window.scrollTo = () => {};
}
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });

// jsdom has no object-URL support; the upload preview uses it.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-preview';
  URL.revokeObjectURL = () => {};
}
