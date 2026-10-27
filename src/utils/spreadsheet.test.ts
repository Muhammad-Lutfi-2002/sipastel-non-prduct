import { describe, it, expect } from 'vitest';
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from './spreadsheet';

describe('sanitizeSpreadsheetCell (CSV / formula injection)', () => {
  it.each(['=HYPERLINK("http://evil","x")', '+SUM(A1)', '-2+3', '@cmd', '\tcmd', '\rcmd'])('neutralises %j', (value) => {
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
  });
  it('leaves normal text and non-strings alone', () => {
    expect(sanitizeSpreadsheetCell('Budi Santoso')).toBe('Budi Santoso');
    expect(sanitizeSpreadsheetCell('a=b')).toBe('a=b');
    expect(sanitizeSpreadsheetCell(42)).toBe(42);
    expect(sanitizeSpreadsheetCell(-5)).toBe(-5);
    expect(sanitizeSpreadsheetCell(null)).toBeNull();
  });
  it('sanitises every field of a row', () => {
    expect(sanitizeSpreadsheetRow({ name: '=1+1', qty: 3, note: 'ok' })).toEqual({ name: "'=1+1", qty: 3, note: 'ok' });
  });
});
