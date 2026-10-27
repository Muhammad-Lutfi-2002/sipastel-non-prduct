import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { init, captureException, withScope } = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: (k: string, v: string) => void }) => void) => cb({ setTag: vi.fn() })),
}));
vi.mock('@sentry/react', () => ({ init, captureException, withScope }));

import { initSentry, reportToSentry } from './sentry';

beforeEach(() => {
  init.mockClear();
  captureException.mockClear();
  withScope.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initSentry', () => {
  it('does nothing when VITE_SENTRY_DSN is not set (e.g. local dev, forks without their own project)', () => {
    initSentry();
    expect(init).not.toHaveBeenCalled();
  });

  it('initialises with no performance tracing and no session replay (PII risk) when a DSN is configured', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    initSentry();
    expect(init).toHaveBeenCalledTimes(1);
    const config = init.mock.calls[0][0];
    expect(config.dsn).toBe('https://key@o0.ingest.de.sentry.io/1');
    expect(config.tracesSampleRate).toBe(0);
    expect(config.integrations).toEqual([]);
  });

  it('tags events with the environment and release', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    vi.stubEnv('VITE_APP_VERSION', 'abc1234');
    initSentry();
    const config = init.mock.calls[0][0];
    expect(config.environment).toBe('test');
    expect(config.release).toBe('abc1234');
  });

  it('falls back to a "dev" release when no version is set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    initSentry();
    expect(init.mock.calls[0][0].release).toBe('dev');
  });

  it('strips request body and cookies before an event ever leaves the browser', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    initSentry();
    const { beforeSend } = init.mock.calls[0][0];
    const scrubbed = beforeSend({ request: { data: { phone: '0812...' }, cookies: 'session=x', url: '/orders' } });
    expect(scrubbed.request).not.toHaveProperty('data');
    expect(scrubbed.request).not.toHaveProperty('cookies');
    expect(scrubbed.request.url).toBe('/orders'); // non-PII fields are kept
  });

  it('passes events through unchanged when there is no request payload', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    initSentry();
    const { beforeSend } = init.mock.calls[0][0];
    const event = { message: 'oops' };
    expect(beforeSend(event)).toBe(event);
  });
});

describe('reportToSentry', () => {
  it('does nothing without a configured DSN', () => {
    reportToSentry({ message: 'boom' }, 'admin');
    expect(withScope).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('tags the event with the boundary name and captures it', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.de.sentry.io/1');
    const setTag = vi.fn();
    withScope.mockImplementationOnce((cb) => cb({ setTag }));

    reportToSentry({ message: 'boom from admin', stack: 'at x.tsx:1' }, 'admin');

    expect(setTag).toHaveBeenCalledWith('boundary', 'admin');
    expect(captureException).toHaveBeenCalledTimes(1);
    const captured = captureException.mock.calls[0][0] as Error;
    expect(captured.message).toBe('boom from admin');
    expect(captured.stack).toBe('at x.tsx:1');
  });
});
