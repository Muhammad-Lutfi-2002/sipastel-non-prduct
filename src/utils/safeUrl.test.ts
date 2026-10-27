import { describe, it, expect } from 'vitest';
import { safeHttpUrl, isTrustedAssetUrl, looksLikeImage } from './safeUrl';

describe('safeHttpUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(safeHttpUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(safeHttpUrl('  http://example.com ')).toBe('http://example.com/');
  });
  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd', 'not a url', '', null, undefined])(
    'rejects %s',
    (value) => {
      expect(safeHttpUrl(value as string)).toBeNull();
    }
  );
});

describe('isTrustedAssetUrl (VITE_SUPABASE_URL=https://test-project.supabase.co)', () => {
  const good = 'https://test-project.supabase.co/storage/v1/object/public/design-uploads/SPS-1/a.png';
  it('trusts this project\'s public storage objects', () => {
    expect(isTrustedAssetUrl(good)).toBe(true);
  });
  it('rejects other hosts, other paths and non-http schemes', () => {
    expect(isTrustedAssetUrl('https://evil.example/storage/v1/object/public/x.png')).toBe(false);
    expect(isTrustedAssetUrl('https://test-project.supabase.co/rest/v1/orders')).toBe(false);
    expect(isTrustedAssetUrl('https://test-project.supabase.co.evil.example/storage/v1/object/public/a.png')).toBe(false);
    expect(isTrustedAssetUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedAssetUrl(null)).toBe(false);
  });
});

describe('looksLikeImage', () => {
  it('recognises raster images by extension, ignoring query strings', () => {
    expect(looksLikeImage('https://x.co/a/b.PNG?v=1')).toBe(true);
    expect(looksLikeImage('design final.jpeg')).toBe(true);
  });
  it('is false for PDF / PSD / empty', () => {
    expect(looksLikeImage('https://x.co/a.pdf')).toBe(false);
    expect(looksLikeImage('mockup.psd')).toBe(false);
    expect(looksLikeImage(null)).toBe(false);
  });
});
