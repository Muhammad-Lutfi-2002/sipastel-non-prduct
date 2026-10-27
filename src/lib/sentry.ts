import * as Sentry from '@sentry/react';

// Sentry setup.
//
// Deliberately conservative for a small-business app on Sentry's free plan:
//  - Error tracking only. No performance/tracing integration and no Session
//    Replay - Replay would record the screen, which for this app means
//    customer names, phone numbers and home addresses ending up as pixels
//    inside Sentry. Not worth it for what this app needs.
//  - No-ops entirely when VITE_SENTRY_DSN is unset, so local development
//    and anyone who forks this project without their own Sentry project
//    never sends events to (or burns quota on) this one.
//  - Stays alongside the self-hosted `client_error_log` Supabase table
//    (see clientErrorLog.ts) rather than replacing it: Sentry gives
//    grouping, stack traces and alerting; the in-app "Log Error Sistem"
//    panel gives the studio owner a glance without needing a Sentry login.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // A release string lets Sentry match a stack trace back to the exact
    // deploy it came from. Set VITE_APP_VERSION in CI (e.g. to the git SHA)
    // to get this for real; falls back to "dev" locally.
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev',
    integrations: [],
    tracesSampleRate: 0,
    beforeSend(event) {
      // Extra safety net beyond `sendDefaultPii: false` (the default): never
      // let a request/response body - which can contain a customer's name,
      // phone number or address - leave the browser attached to an event.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });
}

/** Reports one error to Sentry, tagged with which part of the app it came from. */
export function reportToSentry(error: { message: string; stack?: string }, boundary: string): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag('boundary', boundary);
    const err = new Error(error.message);
    if (error.stack) err.stack = error.stack;
    Sentry.captureException(err);
  });
}
