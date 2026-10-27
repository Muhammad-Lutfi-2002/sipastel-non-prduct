import { describe, it, expect } from 'vitest';
import { detectKindFromBytes, svgLooksSafe, validateUpload } from './upload';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const PSD = [0x38, 0x42, 0x50, 0x53];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function makeFile(content: number[] | string, name: string, type = ''): File {
  const part = typeof content === 'string' ? content : new Uint8Array(content);
  return new File([part], name, { type });
}

describe('detectKindFromBytes', () => {
  it('identifies formats from magic numbers', () => {
    expect(detectKindFromBytes(bytes(...PNG))).toBe('png');
    expect(detectKindFromBytes(bytes(...JPG))).toBe('jpeg');
    expect(detectKindFromBytes(bytes(...PDF))).toBe('pdf');
    expect(detectKindFromBytes(bytes(...PSD))).toBe('psd');
    expect(detectKindFromBytes(bytes(...WEBP))).toBe('webp');
  });
  it('returns null for unknown / HTML content', () => {
    expect(detectKindFromBytes(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectKindFromBytes(new Uint8Array([]))).toBeNull();
  });
});

describe('svgLooksSafe', () => {
  it('accepts plain SVG', () => {
    expect(svgLooksSafe('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')).toBe(true);
  });
  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><foreignObject><div/></foreignObject></svg>',
    'just text',
  ])('rejects %s', (svg) => {
    expect(svgLooksSafe(svg)).toBe(false);
  });
});

describe('validateUpload', () => {
  const opts = { allowed: ['png', 'jpeg', 'pdf', 'psd'] as const, maxBytes: 1024 };

  it('accepts a real PNG and derives the extension from the content, not the name', async () => {
    const res = await validateUpload(makeFile(PNG, 'photo.exe', 'image/png'), { ...opts, allowed: [...opts.allowed] });
    expect(res).toMatchObject({ ok: true, kind: 'png', ext: 'png', contentType: 'image/png' });
  });

  it('rejects an executable/HTML file renamed to .png', async () => {
    const res = await validateUpload(makeFile('<html><script>1</script></html>', 'evil.png', 'image/png'), { ...opts, allowed: [...opts.allowed] });
    expect(res.ok).toBe(false);
  });

  it('accepts PSD even though browsers report an empty MIME type', async () => {
    const res = await validateUpload(makeFile(PSD, 'design.psd', ''), { ...opts, allowed: [...opts.allowed] });
    expect(res).toMatchObject({ ok: true, kind: 'psd' });
  });

  it('rejects formats outside the allow-list', async () => {
    const res = await validateUpload(makeFile(WEBP, 'a.webp', 'image/webp'), { ...opts, allowed: [...opts.allowed] });
    expect(res.ok).toBe(false);
  });

  it('rejects empty and oversized files', async () => {
    expect((await validateUpload(makeFile([], 'a.png'), { ...opts, allowed: [...opts.allowed] })).ok).toBe(false);
    const big = makeFile([...PNG, ...new Array(2000).fill(1)], 'a.png', 'image/png');
    const res = await validateUpload(big, { ...opts, allowed: [...opts.allowed] });
    expect(res).toMatchObject({ ok: false });
  });

  it('allows a clean SVG only when svg is allowed, and blocks scripted SVG', async () => {
    const clean = makeFile('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'logo.svg', 'image/svg+xml');
    expect((await validateUpload(clean, { allowed: ['png', 'svg'], maxBytes: 1024 })).ok).toBe(true);
    expect((await validateUpload(clean, { allowed: ['png'], maxBytes: 1024 })).ok).toBe(false);
    const evil = makeFile('<svg><script>alert(1)</script></svg>', 'logo.svg', 'image/svg+xml');
    expect((await validateUpload(evil, { allowed: ['png', 'svg'], maxBytes: 1024 })).ok).toBe(false);
  });
});
