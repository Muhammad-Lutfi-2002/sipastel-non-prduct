import { supabase } from '../lib/supabaseClient';
import { reportToSentry } from '../lib/sentry';

// Client-side error reporting.
//
// Before this, a runtime error only ever reached `console.error` - visible
// solely to whoever happened to have DevTools open at that exact moment
// (almost never the studio owner). This sends a short, sanitised report to
// the `client_error_log` table instead, so errors are visible afterwards
// from the database. It intentionally does NOT depend on any third-party
// error-tracking service or API key - it reuses the Supabase project this
// app already talks to.
//
// If you later want a fuller tool (breadcrumbs, session replay, alerting)
// you can add Sentry alongside this: set VITE_SENTRY_DSN and initialise it
// in main.tsx. This logger can stay as a zero-dependency fallback either way.

export interface ClientErrorReport {
  /** Which part of the app the error came from, e.g. "admin", "storefront". */
  boundary: string;
  message: string;
  stack?: string;
  componentStack?: string;
}

const MAX_FIELD_LENGTH = 4000;
const truncate = (s: string | undefined) => (s ? s.slice(0, MAX_FIELD_LENGTH) : null);

// A simple in-memory throttle: a render loop that keeps re-throwing must
// never turn into a flood of INSERTs. At most 5 reports per boundary per
// page load.
const sentCounts = new Map<string, number>();
const MAX_REPORTS_PER_BOUNDARY = 5;

export async function logClientError(report: ClientErrorReport): Promise<void> {
  const count = sentCounts.get(report.boundary) ?? 0;
  if (count >= MAX_REPORTS_PER_BOUNDARY) return;
  sentCounts.set(report.boundary, count + 1);

  // Sentry gets the full picture (stack trace, grouping, alerting) whenever
  // VITE_SENTRY_DSN is configured; a no-op otherwise. Kept separate from the
  // Supabase insert below so one failing does not affect the other.
  reportToSentry({ message: report.message, stack: report.stack }, report.boundary);

  try {
    await supabase.from('client_error_log').insert({
      boundary: report.boundary,
      message: truncate(report.message) ?? 'Unknown error',
      stack: truncate(report.stack),
      component_stack: truncate(report.componentStack),
      page_path: typeof window !== 'undefined' ? window.location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    });
  } catch {
    // Logging the error must never itself throw or surface to the user -
    // this is best-effort telemetry, not a critical path.
  }
}

/** Wires window-level handlers for errors ErrorBoundary can't catch (async code, event handlers, promise rejections). */
export function installGlobalErrorLogging(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    void logClientError({
      boundary: 'window',
      message: event.message,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    void logClientError({
      boundary: 'unhandled-promise',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

export interface ClientErrorEntry {
  id: string;
  boundary: string;
  message: string;
  pagePath: string | null;
  createdAt: string;
}

/** Recent entries for the staff-facing "Log Error Sistem" panel (Settings). RLS restricts this to OWNER/PRODUCTION_HEAD. */
export async function fetchRecentClientErrors(): Promise<{ data: ClientErrorEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('client_error_log')
    .select('id, boundary, message, page_path, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to load client error log:', error.message);
    return { data: [], error: 'Tidak dapat memuat log error dari server.' };
  }
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      boundary: r.boundary as string,
      message: r.message as string,
      pagePath: (r.page_path as string) ?? null,
      createdAt: r.created_at as string,
    })),
    error: null,
  };
}
