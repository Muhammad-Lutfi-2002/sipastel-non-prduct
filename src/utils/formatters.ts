export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// No 0/O/1/I so an ID read aloud or typed from a screenshot is not ambiguous.
const ORDER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols -> no modulo bias with bytes

function randomOrderSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ORDER_ID_ALPHABET[b % ORDER_ID_ALPHABET.length]).join('');
}

// Format: SPS-YYYYMMDD-XXXXXX. The suffix comes from the browser's
// cryptographic RNG (not Math.random) so IDs are not guessable - the ID plus
// the phone number is what protects the public order-tracking lookup.
export function generateOrderId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `SPS-${year}${month}${day}-${randomOrderSuffix(6)}`;
}

export function generateInvoiceNumber(orderId: string): string {
  return `INV/${orderId.replace('SPS-', '')}`;
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // The label below says WIB, so the time must really be WIB no matter
      // which timezone the viewer's browser is set to.
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB';
  } catch {
    return isoString;
  }
}

export function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'FINANCE':
      return 'Finance';
    case 'PRODUCTION_HEAD':
      return 'Kepala Produksi';
    case 'MARKETING':
      return 'Marketing';
    case 'INVESTOR':
      return 'Investor';
    default:
      return 'Staf';
  }
}

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  WAITING_VALIDATION: 'Menunggu Validasi',
  PRODUCTION_QUEUE: 'Antrean Produksi',
  DESIGN: 'Desain',
  DESIGN_APPROVAL: 'Menunggu Persetujuan Desain',
  DESIGN_REVISION: 'Revisi Desain',
  DESIGN_APPROVED: 'Desain Disetujui',
  CUTTING: 'Potong Bahan',
  SEWING: 'Menjahit',
  PRINTING: 'Sablon/Bordir',
  QC: 'Quality Control',
  REWORK: 'Perbaikan',
  PACKING: 'Packing',
  READY_TO_SHIP: 'Siap Kirim',
};

export function formatProductionStatusLabel(status?: string): string {
  if (!status) return '-';
  return PRODUCTION_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  NOT_SHIPPED: 'Belum Dikirim',
  SHIPPED: 'Dikirim',
  IN_TRANSIT: 'Dalam Perjalanan',
  DELIVERED: 'Terkirim',
  COMPLETED: 'Selesai',
};

export function formatShippingStatusLabel(status?: string): string {
  if (!status) return '-';
  return SHIPPING_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  DP_DIBAYAR: 'DP Dibayar',
  LUNAS: 'Lunas',
};

export function formatPaymentStatusLabel(status?: string): string {
  if (!status) return '-';
  return PAYMENT_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

/** Indonesian day-part greeting: pagi / siang / sore / malam. */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}
