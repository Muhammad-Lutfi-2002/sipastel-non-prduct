// CORS helper shared by every API route in the Worker.
//
// ALLOWED_ORIGIN in wrangler config can be a single origin
// ("https://sipastel.pages.dev") or a comma-separated list
// ("https://sipastel.pages.dev,https://sipastel.example.com") so the same
// Worker can serve both a staging and a production frontend.

/**
 * True only for a genuine loopback origin. A plain `startsWith('http://localhost')`
 * check also matches "http://localhost.evil.com", which would let any
 * attacker-controlled host pass the CORS check.
 */
export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function resolveAllowedOrigin(request: Request, allowedOriginConfig: string): string | null {
  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) return null;

  const allowList = allowedOriginConfig
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Allow local development regardless of configured list.
  const isLocalDev = isLocalOrigin(requestOrigin);

  if (allowList.includes('*')) return requestOrigin;
  if (isLocalDev) return requestOrigin;
  if (allowList.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(request: Request, allowedOriginConfig: string): Record<string, string> {
  const origin = resolveAllowedOrigin(request, allowedOriginConfig);
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; request: Request; allowedOriginConfig: string }
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(init.request, init.allowedOriginConfig),
    },
  });
}
