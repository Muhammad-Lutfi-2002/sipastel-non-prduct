// Resizes and re-encodes uploaded raster images to WebP inside the Worker,
// using @cf-wasm/photon (a WASM build of the Rust "photon" image library
// that runs in the Workers runtime — no native binaries, no external
// image API needed).
//
// PDFs (allowed for custom-order design uploads) are never touched here;
// callers should only invoke this for image/* content types.

import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';

export interface OptimizeResult {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
}

export interface OptimizeOptions {
  /** Longest edge, in pixels, the output image is scaled down to. */
  maxDimension: number;
  /** WebP quality 0-100. */
  quality: number;
}

// Per-folder defaults: product photography needs more headroom for zoom,
// profile pictures and banners are always displayed small/medium.
export const OPTIMIZE_PRESETS: Record<string, OptimizeOptions> = {
  products: { maxDimension: 1920, quality: 82 },
  gallery: { maxDimension: 1920, quality: 80 },
  banners: { maxDimension: 2400, quality: 80 },
  profiles: { maxDimension: 800, quality: 82 },
  designs: { maxDimension: 1600, quality: 82 },
};

export async function optimizeImage(
  inputBytes: Uint8Array,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  const input = PhotonImage.new_from_byteslice(inputBytes);
  try {
    const originalWidth = input.get_width();
    const originalHeight = input.get_height();
    const longestEdge = Math.max(originalWidth, originalHeight);

    let working = input;
    let ownsWorking = false;

    if (longestEdge > options.maxDimension) {
      const scale = options.maxDimension / longestEdge;
      const targetWidth = Math.round(originalWidth * scale);
      const targetHeight = Math.round(originalHeight * scale);
      working = resize(input, targetWidth, targetHeight, SamplingFilter.Lanczos3);
      ownsWorking = true;
    }

    const webpBytes = working.get_bytes_webp();

    const result: OptimizeResult = {
      bytes: webpBytes,
      contentType: 'image/webp',
      width: working.get_width(),
      height: working.get_height(),
    };

    if (ownsWorking) working.free();
    return result;
  } finally {
    input.free();
  }
}
