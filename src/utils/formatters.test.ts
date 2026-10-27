import { describe, it, expect } from 'vitest';
import { generateOrderId, generateInvoiceNumber, getGreeting, formatDateTime, formatIDR } from './formatters';

describe('generateOrderId', () => {
  it('uses the SPS-YYYYMMDD-XXXXXX shape with an unambiguous alphabet', () => {
    const id = generateOrderId(new Date(2026, 8, 5, 10, 0, 0));
    expect(id).toMatch(/^SPS-20260905-[A-HJ-NP-Z2-9]{6}$/);
  });
  it('does not collide across many generations', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateOrderId()));
    expect(ids.size).toBe(5000);
  });
  it('does not use Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random must not be used for order IDs');
    };
    try {
      expect(() => generateOrderId()).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('generateInvoiceNumber', () => {
  it('derives a stable invoice number from the order id', () => {
    const id = 'SPS-20260905-ABC234';
    expect(generateInvoiceNumber(id)).toBe(generateInvoiceNumber(id));
  });
});

describe('getGreeting', () => {
  it.each([
    [6, 'Selamat pagi'],
    [10, 'Selamat pagi'],
    [11, 'Selamat siang'],
    [14, 'Selamat siang'],
    [15, 'Selamat sore'],
    [17, 'Selamat sore'],
    [18, 'Selamat malam'],
    [23, 'Selamat malam'],
    [2, 'Selamat pagi'],
  ])('at %s:00 -> %s', (hour, expected) => {
    expect(getGreeting(new Date(2026, 8, 21, hour, 0, 0))).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it('renders Jakarta time so the WIB label is truthful in any browser timezone', () => {
    // 2026-09-21T03:30:00Z is 10:30 in Jakarta (UTC+7).
    const out = formatDateTime('2026-09-21T03:30:00Z');
    expect(out).toMatch(/10[.:]30/);
    expect(out.endsWith('WIB')).toBe(true);
  });
});

describe('formatIDR', () => {
  it('formats rupiah', () => {
    expect(formatIDR(1500000).replace(/\s/g, '')).toMatch(/Rp1\.500\.000/);
  });
});
