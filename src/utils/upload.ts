// Client-side upload validation.
//
// `File.type` and the file extension are both chosen by the sender, so on
// their own they say nothing about what the bytes really are. Before a file
// is sent to public storage we therefore check its magic number as well,
// and derive the stored extension from the detected type instead of trusting
// the original file name. (Storage bucket policies remain the authoritative
// server-side control - this is the first line of defence and gives users a
// clear error message immediately.)

export type DetectedFileKind = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'pdf' | 'psd' | 'svg';

export const KIND_TO_MIME: Record<DetectedFileKind, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  pdf: 'application/pdf',
  psd: 'image/vnd.adobe.photoshop',
  svg: 'image/svg+xml',
};

export const KIND_TO_EXT: Record<DetectedFileKind, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
  pdf: 'pdf',
  psd: 'psd',
  svg: 'svg',
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

export function detectKindFromBytes(bytes: Uint8Array): DetectedFileKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  // ....ftypavif / avis
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69], 4)) return 'avif';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (startsWith(bytes, [0x38, 0x42, 0x50, 0x53])) return 'psd';
  return null;
}

// Blob.arrayBuffer()/text() are missing in older Safari and in jsdom;
// FileReader works everywhere.
function readBlobAs<T extends 'arrayBuffer' | 'text'>(blob: Blob, mode: T): Promise<T extends 'text' ? string : ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as never);
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file.'));
    if (mode === 'text') reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
}

/** Reads the first bytes of a File and identifies it (SVG is handled separately as text). */
export async function detectFileKind(file: Blob): Promise<DetectedFileKind | null> {
  const head = new Uint8Array(await readBlobAs(file.slice(0, 16), 'arrayBuffer'));
  return detectKindFromBytes(head);
}

/**
 * SVG is XML and can carry script. We only allow it for the logo, and only
 * when it contains nothing executable.
 */
export function svgLooksSafe(svgText: string): boolean {
  const lower = svgText.toLowerCase();
  if (!lower.includes('<svg')) return false;
  if (lower.includes('<script')) return false;
  if (lower.includes('<foreignobject')) return false;
  if (/\son[a-z]+\s*=/.test(lower)) return false;
  if (lower.includes('javascript:')) return false;
  return true;
}

export interface UploadValidationOptions {
  allowed: DetectedFileKind[];
  maxBytes: number;
  /** Label used in error messages, e.g. "Gambar", "Logo". */
  label?: string;
}

export type UploadValidationResult =
  | { ok: true; kind: DetectedFileKind; ext: string; contentType: string }
  | { ok: false; error: string };

const KIND_LABEL: Record<DetectedFileKind, string> = {
  png: 'PNG',
  jpeg: 'JPG',
  webp: 'WEBP',
  gif: 'GIF',
  avif: 'AVIF',
  pdf: 'PDF',
  psd: 'PSD',
  svg: 'SVG',
};

export function describeAllowed(allowed: DetectedFileKind[]): string {
  return allowed.map((k) => KIND_LABEL[k]).join(', ');
}

export async function validateUpload(file: File, options: UploadValidationOptions): Promise<UploadValidationResult> {
  const { allowed, maxBytes } = options;
  const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;

  if (file.size <= 0) {
    return { ok: false, error: 'File kosong atau tidak bisa dibaca.' };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: `Ukuran file maksimal ${mb}MB.` };
  }

  let kind = await detectFileKind(file);

  if (!kind && allowed.includes('svg')) {
    const looksSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (looksSvg) {
      const text = await readBlobAs(file, 'text');
      if (svgLooksSafe(text)) kind = 'svg';
      else return { ok: false, error: 'File SVG mengandung konten yang tidak diizinkan (script).' };
    }
  }

  if (!kind || !allowed.includes(kind)) {
    return { ok: false, error: `Format tidak didukung. Gunakan ${describeAllowed(allowed)}.` };
  }

  return { ok: true, kind, ext: KIND_TO_EXT[kind], contentType: KIND_TO_MIME[kind] };
}
