// Spreadsheet export helpers.
//
// Order fields such as customer name, address and notes are typed by
// unauthenticated visitors. If one starts with "=", "+", "-" or "@", Excel
// and LibreOffice will evaluate it as a formula when the exported file is
// opened (CSV/formula injection). Prefixing such text with an apostrophe
// forces it to be treated as literal text.

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function sanitizeSpreadsheetCell<T>(value: T): T | string {
  if (typeof value !== 'string') return value;
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

export function sanitizeSpreadsheetRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key] = sanitizeSpreadsheetCell(val);
  }
  return out;
}
