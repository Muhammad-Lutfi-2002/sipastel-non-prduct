import { toWhatsAppNumber } from './phone';

let warnedMissingNumber = false;

/**
 * The studio's WhatsApp number from VITE_WHATSAPP_NUMBER, normalised to
 * international format. Returns "" when it is not configured - we never fall
 * back to a made-up number, because customers' messages would then be sent
 * to a stranger.
 */
export function getWhatsAppNumber(): string {
  const envNumber = import.meta.env?.VITE_WHATSAPP_NUMBER;
  if (envNumber && typeof envNumber === 'string' && envNumber.trim().length > 0) {
    return toWhatsAppNumber(envNumber);
  }
  if (!warnedMissingNumber) {
    warnedMissingNumber = true;
    console.warn('VITE_WHATSAPP_NUMBER is not set: WhatsApp links will open without a preset recipient.');
  }
  return '';
}

/**
 * Builds a wa.me link. `customPhone` accepts any local/international format
 * ("0812-3456-7890", "+62 812...", "62812...") and is normalised, since wa.me
 * only understands the international form.
 */
export function createWhatsAppUrl(message: string, customPhone?: string): string {
  const number = customPhone ? toWhatsAppNumber(customPhone) : getWhatsAppNumber();
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encodedText}`;
}

export function getCustomOrderWhatsAppMessage(params: {
  orderId: string;
  name: string;
  product: string;
  quantity: number | string;
  request: string;
  paymentPreference: 'DP' | 'LUNAS';
  paymentPreferencePercentage: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  pricePerUnitFormatted?: string;
  totalPriceFormatted?: string;
  payNowFormatted?: string;
  remainingFormatted?: string;
}): string {
  const paymentLine =
    params.paymentPreference === 'LUNAS'
      ? 'Lunas (Bayar Penuh)'
      : `DP ${params.paymentPreferencePercentage}% (Uang Muka)`;

  const priceLines =
    params.totalPriceFormatted && params.payNowFormatted
      ? `\n\nHarga Satuan:\n${params.pricePerUnitFormatted ?? '-'} / pcs\n\nTotal Harga:\n${params.totalPriceFormatted}\n\nDibayar Sekarang:\n${params.payNowFormatted}${
          params.paymentPreference === 'DP' && params.remainingFormatted
            ? `\n\nSisa Pelunasan:\n${params.remainingFormatted}`
            : ''
        }`
      : '';

  const bankLines =
    params.bankName && params.bankAccountNumber
      ? `\n\nRekening Tujuan Transfer:\n${params.bankName} ${params.bankAccountNumber} a.n. ${params.bankAccountHolder ?? '-'}`
      : '';

  return `Hi SIPASTEL, saya ingin mengonfirmasi custom order saya.

Order ID:
${params.orderId}

Nama:
${params.name}

Produk:
${params.product}

Quantity:
${params.quantity}

Request:
${params.request}

Preferensi Pembayaran:
${paymentLine}${priceLines}${bankLines}

Mohon konfirmasi pembayarannya ya, terima kasih!`;
}

export function getProductOrderWhatsAppMessage(params: {
  orderId: string;
  name: string;
  itemsList: string;
  totalFormatted: string;
  shippingAddress: string;
}): string {
  return `Hi SIPASTEL, saya ingin mengonfirmasi pesanan saya.

Order ID:
${params.orderId}

Nama:
${params.name}

Pesanan:
${params.itemsList}

Total:
${params.totalFormatted}

Alamat Pengiriman:
${params.shippingAddress}

Mohon instruksi pembayaran dan estimasi pengerjaan. Terima kasih!`;
}

export function getProductInquiryWhatsAppMessage(productName: string, selectedVariant?: string): string {
  return `Hi SIPASTEL, saya tertarik dengan produk ${productName}${selectedVariant ? ` (${selectedVariant})` : ''}. Apakah masih tersedia dan bisa konsultasi ukuran? Terima kasih.`;
}
