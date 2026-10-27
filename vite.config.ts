import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {sentryVitePlugin} from '@sentry/vite-plugin';

export default defineConfig(() => {
  // Source maps + upload only run when a token is present (CI secret or a
  // developer's own local env). Without one, the build is unaffected -
  // Sentry still receives errors, just with minified stack traces.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(sentryAuthToken
        ? [
            sentryVitePlugin({
              org: 'lutfi-qk',
              project: 'sipastel',
              authToken: sentryAuthToken,
              // Source maps are uploaded to Sentry, then deleted from the
              // deployed output - never ship your real source layout to
              // every visitor's browser.
              sourcemaps: { filesToDeleteAfterUpload: ['**/*.map'] },
              release: { name: process.env.VITE_APP_VERSION || undefined },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      // Only emit source maps when they're actually going to be uploaded -
      // no reason to slow down every ordinary build for a file that is
      // immediately deleted anyway.
      sourcemap: !!sentryAuthToken,
      rollupOptions: {
        output: {
          // Long-lived vendor chunks cache across deploys, so a code change in
          // the app does not force users to re-download React/Supabase.
          manualChunks: {
            react: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            sentry: ['@sentry/react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
