import { describe, it, expect } from 'vitest';
import { normalizeIdPhone, isSamePhone, phoneLookupVariants, toWhatsAppNumber } from './phone';

describe('normalizeIdPhone', () => {
  it.each([
    ['0812-3456-7890', '6281234567890'],
    ['+62 812 3456 7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['812 3456 7890', '6281234567890'],
    ['+62 (0)812-3456-7890', '6281234567890'],
    ['0062 812 3456 7890', '6281234567890'],
    ['  0812.3456.7890 ', '6281234567890'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeIdPhone(input)).toBe(expected);
  });

  it('leaves foreign numbers as digits', () => {
    expect(normalizeIdPhone('+1 415 555 0100')).toBe('14155550100');
  });

  it('returns empty string for empty / junk input', () => {
    expect(normalizeIdPhone('')).toBe('');
    expect(normalizeIdPhone('abc')).toBe('');
    expect(normalizeIdPhone(undefined as unknown as string)).toBe('');
  });
});

describe('isSamePhone', () => {
  it('treats different spellings of one number as equal', () => {
    expect(isSamePhone('0812-3456-7890', '+62 812 3456 7890')).toBe(true);
  });
  it('is false for different numbers and for empties', () => {
    expect(isSamePhone('0812-3456-7890', '0812-3456-7891')).toBe(false);
    expect(isSamePhone('', '')).toBe(false);
  });
});

describe('phoneLookupVariants', () => {
  it('offers raw, international and local spellings without duplicates', () => {
    expect(phoneLookupVariants('0812-3456-7890')).toEqual(['0812-3456-7890', '6281234567890', '081234567890']);
    expect(phoneLookupVariants('6281234567890')).toEqual(['6281234567890', '081234567890']);
  });
  it('is empty for blank input', () => {
    expect(phoneLookupVariants('   ')).toEqual([]);
  });
});

describe('toWhatsAppNumber', () => {
  it('produces the digits-only international form wa.me expects', () => {
    expect(toWhatsAppNumber('0896-7734-3212')).toBe('62896773 43212'.replace(' ', ''));
  });
});
