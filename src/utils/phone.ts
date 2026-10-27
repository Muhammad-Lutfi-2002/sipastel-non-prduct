// Indonesian phone-number helpers.
//
// Customers type their number in many shapes ("0812-3456-7890",
// "+62 812 3456 7890", "62812...", "812..."), but everything that talks to
// WhatsApp (wa.me) needs the international form without a leading "+" or "0".
// Keeping one normalizer here means the WhatsApp links, the customer
// directory and order tracking all agree on what "the same number" means.

/** Digits only. */
function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Normalises an Indonesian phone number to international format without
 * the "+" (e.g. "6281234567890"). Numbers that already carry a different
 * country code are returned as plain digits, untouched.
 */
export function normalizeIdPhone(input: string): string {
  let digits = digitsOnly(input ?? '');
  if (!digits) return '';

  // "0062812..." (international dialling prefix) -> "62812..."
  if (digits.startsWith('00')) digits = digits.slice(2);

  // "+62 0812..." - people often keep the trunk "0" after the country code.
  if (digits.startsWith('620')) return `62${digits.slice(3)}`;
  if (digits.startsWith('62')) return digits;
  // Local format "0812..." -> "62812..."
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  // Mobile numbers typed without the leading zero: "812..."
  if (digits.startsWith('8')) return `62${digits}`;

  return digits;
}

/** True when two raw inputs refer to the same subscriber number. */
export function isSamePhone(a: string, b: string): boolean {
  const na = normalizeIdPhone(a);
  const nb = normalizeIdPhone(b);
  return na !== '' && na === nb;
}

/**
 * All spellings worth trying when looking a number up against data that may
 * have been stored in any of the historical formats: what the user typed,
 * the local "08..." form and the international "628..." form.
 */
export function phoneLookupVariants(input: string): string[] {
  const raw = (input ?? '').trim();
  if (!raw) return [];
  const intl = normalizeIdPhone(raw);
  const variants = [raw, intl];
  if (intl.startsWith('62')) variants.push(`0${intl.slice(2)}`);
  return Array.from(new Set(variants.filter(Boolean)));
}

/** Number in the exact shape wa.me expects. */
export function toWhatsAppNumber(input: string): string {
  return normalizeIdPhone(input);
}
