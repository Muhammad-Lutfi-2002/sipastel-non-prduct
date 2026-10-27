// SIPASTEL Worker
// ----------------
// Single Worker that:
//   1. Serves the built Vite SPA (via the `assets` binding) for every
//      normal page request — unchanged from how the project already
//      deploys with `wrangler deploy`.
//   2. Adds a small JSON/multipart API under /api/images/* that is the
//      ONLY thing allowed to talk to the R2 bucket. The bucket is wired
//      in via a native R2 binding, so no Account ID / Access Key /
//      Secret Access Key ever exists anywhere in this code or in the
//      frontend — Cloudflare handles that at the infrastructure level.
//   3. Serves uploaded images back out at /cdn/<key> with long-lived,
//      immutable cache headers (or you can point a custom domain
//      directly at the bucket instead — see README/DEPLOY notes).

import { verifyStaffRequest } from './lib/auth';
import { corsHeaders, jsonResponse } from './lib/cors';
import { optimizeImage, OPTIMIZE_PRESETS } from './lib/imageProcessing';

export interface Env {
  ASSETS: Fetcher;
  IMAGES_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGIN: string;
  MAX_UPLOAD_MB: string;
}

// Folders this API is willing to write into / read from. Keep this list in
// sync with OPTIMIZE_PRESETS in lib/imageProcessing.ts.
const ALLOWED_FOLDERS = new Set(['designs', 'products', 'profiles', 'banners', 'gallery']);

// Only the public custom-order design upload is allowed without a logged-in
// staff session, to preserve the existing unauthenticated customer flow.
// Every other folder (products/profiles/banners/gallery) is admin-only.
const PUBLIC_UPLOAD_FOLDERS = new Set(['designs']);

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif']);
const ALLOWED_DESIGN_EXTRA_TYPES = new Set(['application/pdf']);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
        return new Response(null, { status: 204, headers: corsHeaders(request, env.ALLOWED_ORIGIN) });
      }

      if (url.pathname === '/api/images/upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }

      if (url.pathname === '/api/images/delete' && request.method === 'POST') {
        return await handleDelete(request, env);
      }

      if (url.pathname.startsWith('/cdn/') && request.method === 'GET') {
        return await handleServeObject(request, env, url.pathname.slice('/cdn/'.length));
      }

      // Everything else: serve the built SPA / static files, unchanged.
      return await env.ASSETS.fetch(request);
    } catch (err) {
      console.error('Unhandled Worker error:', err);
      return jsonResponse(
        { error: 'Internal server error' },
        { status: 500, request, allowedOriginConfig: env.ALLOWED_ORIGIN }
      );
    }
  },
};

function safeSegment(input: string, fallback: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return cleaned || fallback;
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/avif':
      return 'avif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const respond = (body: unknown, status = 200) =>
    jsonResponse(body, { status, request, allowedOriginConfig: env.ALLOWED_ORIGIN });

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return respond({ error: 'Expected multipart/form-data with a "file" field.' }, 400);
  }

  const form = await request.formData();
  const file = form.get('file');
  const folderRaw = String(form.get('folder') ?? 'designs');
  const ownerId = form.get('ownerId'); // e.g. orderId, productId, staffId — used only for path organization

  if (!(file instanceof File)) {
    return respond({ error: 'Missing "file" in form data.' }, 400);
  }
  if (!ALLOWED_FOLDERS.has(folderRaw)) {
    return respond({ error: `Invalid folder. Allowed: ${[...ALLOWED_FOLDERS].join(', ')}` }, 400);
  }
  const folder = folderRaw;

  // Auth gate: only "designs" (the public custom-order form) may upload
  // without a logged-in staff session.
  if (!PUBLIC_UPLOAD_FOLDERS.has(folder)) {
    const staff = await verifyStaffRequest(request, env);
    if (!staff) {
      return respond({ error: 'Authentication required to upload to this folder.' }, 401);
    }
  }

  const maxBytes = Number(env.MAX_UPLOAD_MB || '8') * 1024 * 1024;
  if (file.size > maxBytes) {
    return respond({ error: `File exceeds the ${env.MAX_UPLOAD_MB || 8}MB limit.` }, 413);
  }

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isDesignExtra = folder === 'designs' && ALLOWED_DESIGN_EXTRA_TYPES.has(file.type);

  if (!isImage && !isDesignExtra) {
    return respond(
      { error: 'Unsupported file type. Allowed: PNG, JPG, WEBP, AVIF' + (folder === 'designs' ? ', PDF.' : '.') },
      415
    );
  }

  const inputBytes = new Uint8Array(await file.arrayBuffer());

  let outputBytes: Uint8Array = inputBytes;
  let outputContentType = file.type;

  if (isImage) {
    try {
      const preset = OPTIMIZE_PRESETS[folder] ?? OPTIMIZE_PRESETS.gallery;
      const optimized = await optimizeImage(inputBytes, preset);
      outputBytes = optimized.bytes;
      outputContentType = optimized.contentType;
    } catch (err) {
      // Never let optimization failure break the upload — fall back to
      // storing the original bytes untouched so the feature stays as
      // reliable as the Supabase Storage version it replaces.
      console.error('Image optimization failed, storing original:', err);
      outputBytes = inputBytes;
      outputContentType = file.type;
    }
  }

  const ownerSegment = safeSegment(String(ownerId ?? ''), 'general');
  const ext = extensionFor(outputContentType);
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const key = `${folder}/${ownerSegment}/${Date.now()}-${uniqueId}.${ext}`;

  await env.IMAGES_BUCKET.put(key, outputBytes, {
    httpMetadata: { contentType: outputContentType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { originalName: file.name, folder },
  });

  const publicUrl = `${new URL(request.url).origin}/cdn/${key}`;

  return respond({
    url: publicUrl,
    key,
    contentType: outputContentType,
    size: outputBytes.byteLength,
  });
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const respond = (body: unknown, status = 200) =>
    jsonResponse(body, { status, request, allowedOriginConfig: env.ALLOWED_ORIGIN });

  // Deletion is always admin-only, even for the "designs" folder — a
  // customer never had a delete affordance in the existing UI either.
  const staff = await verifyStaffRequest(request, env);
  if (!staff) {
    return respond({ error: 'Authentication required.' }, 401);
  }

  let body: { key?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return respond({ error: 'Invalid JSON body.' }, 400);
  }

  let key = body.key ?? '';
  if (!key && body.url) {
    const marker = '/cdn/';
    const idx = body.url.indexOf(marker);
    if (idx !== -1) key = decodeURIComponent(body.url.slice(idx + marker.length));
  }

  if (!key || key.includes('..') || !/^([a-zA-Z0-9._-]+\/){2,}[a-zA-Z0-9._-]+$/.test(key)) {
    return respond({ error: 'Invalid or missing object key.' }, 400);
  }

  const folder = key.split('/')[0];
  if (!ALLOWED_FOLDERS.has(folder)) {
    return respond({ error: 'Refusing to delete outside managed folders.' }, 400);
  }

  await env.IMAGES_BUCKET.delete(key);
  return respond({ success: true, key });
}

async function handleServeObject(request: Request, env: Env, key: string): Promise<Response> {
  const decodedKey = decodeURIComponent(key);
  const object = await env.IMAGES_BUCKET.get(decodedKey);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  headers.set('Access-Control-Allow-Origin', '*');
  // Uploaded files are user content: never let a browser sniff them into
  // something executable, and sandbox them if opened directly.
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");

  return new Response(object.body, { headers });
}
