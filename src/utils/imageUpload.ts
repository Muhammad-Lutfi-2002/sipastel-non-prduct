// Client for the SIPASTEL Worker's image API, which is the only thing
// allowed to talk to Cloudflare R2. The frontend never sees an R2
// credential of any kind — it just POSTs files to this HTTP API and gets
// back a plain https URL to store in Supabase (e.g. orders.design_url,
// products.images).
//
// VITE_UPLOAD_API_URL is optional: leave it unset when the Worker serves
// the frontend itself (same-origin deploy via `wrangler deploy`), or set
// it to the Worker's absolute URL when the frontend is hosted elsewhere
// (e.g. GitHub Pages / a separate Cloudflare Pages project).
import { supabase } from '../lib/supabaseClient';

const API_BASE = (import.meta.env.VITE_UPLOAD_API_URL ?? '').replace(/\/$/, '');

export type ImageFolder = 'designs' | 'products' | 'profiles' | 'banners' | 'gallery';

export interface UploadImageResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Uploads an image (or, for the "designs" folder, a PDF) through the
 * Worker. The Worker resizes/compresses/converts raster images to WebP
 * before storing them in R2, then returns the public URL to save on the
 * corresponding Supabase row.
 *
 * `folder` "designs" works without a logged-in session (public custom
 * order form). Every other folder requires an authenticated staff
 * session and the Worker will reject the request otherwise.
 */
export async function uploadImage(
  file: File,
  folder: ImageFolder,
  ownerId?: string
): Promise<UploadImageResult | null> {
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (ownerId) form.append('ownerId', ownerId);

    const headers = folder === 'designs' ? {} : await authHeaders();

    const res = await fetch(`${API_BASE}/api/images/upload`, {
      method: 'POST',
      body: form,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('Image upload failed:', res.status, body);
      return null;
    }

    return (await res.json()) as UploadImageResult;
  } catch (e) {
    console.error('Unexpected error uploading image:', e);
    return null;
  }
}

/**
 * Deletes a previously uploaded image from R2 given its public /cdn/ URL
 * (or a raw object key). Always requires an authenticated staff session.
 */
export async function deleteImage(urlOrKey: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const body = urlOrKey.includes('/cdn/') ? { url: urlOrKey } : { key: urlOrKey };

    const res = await fetch(`${API_BASE}/api/images/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      console.error('Image delete failed:', res.status, responseBody);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Unexpected error deleting image:', e);
    return false;
  }
}

/**
 * Convenience helper for "replace image" flows: uploads the new file
 * first, and only deletes the old one once the new upload has succeeded,
 * so a failed upload never leaves the record pointing at nothing.
 */
export async function replaceImage(
  oldUrlOrKey: string | null | undefined,
  newFile: File,
  folder: ImageFolder,
  ownerId?: string
): Promise<UploadImageResult | null> {
  const result = await uploadImage(newFile, folder, ownerId);
  if (!result) return null;
  if (oldUrlOrKey) {
    // Best-effort cleanup — the new image is already live and saved by the
    // caller, so a failure to delete the old object is logged, not fatal.
    await deleteImage(oldUrlOrKey);
  }
  return result;
}
