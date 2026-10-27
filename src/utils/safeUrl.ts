// URL safety helpers.
//
// Several columns (orders.design_url, products.images) are written by
// unauthenticated customers or pasted in by staff, then rendered as
// <a href> / <img src> in the admin console. Treating them as trusted
// strings would allow `javascript:` links, tracking pixels pointed at
// third-party hosts, and similar abuse. These helpers make the trust
// decision explicit in one place.

/** Returns the URL only if it is a well-formed http(s) URL, else null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function supabaseHost(): string | null {
  const raw = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/**
 * True when the URL points at storage this application owns (the Supabase
 * project's storage endpoint, or the Worker's /cdn/ path on the configured
 * upload host). Anything else, e.g. a customer-supplied link, is untrusted.
 */
export function isTrustedAssetUrl(value: string | null | undefined): boolean {
  const safe = safeHttpUrl(value);
  if (!safe) return false;
  const url = new URL(safe);

  const host = supabaseHost();
  if (host && url.host === host && url.pathname.startsWith('/storage/v1/object/public/')) {
    return true;
  }

  const uploadBase = (import.meta.env?.VITE_UPLOAD_API_URL as string | undefined)?.trim();
  if (uploadBase) {
    try {
      const base = new URL(uploadBase);
      if (url.host === base.host && url.pathname.startsWith('/cdn/')) return true;
    } catch {
      /* ignore malformed config */
    }
  } else if (typeof window !== 'undefined' && url.origin === window.location.origin) {
    return url.pathname.startsWith('/cdn/');
  }

  return false;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i;

/** Best-effort check from the URL path (or a file name) that this is a raster image. */
export function looksLikeImage(urlOrName: string | null | undefined): boolean {
  if (!urlOrName) return false;
  let path = urlOrName;
  try {
    path = new URL(urlOrName).pathname;
  } catch {
    /* plain file name */
  }
  return IMAGE_EXTENSIONS.test(decodeURIComponent(path));
}
