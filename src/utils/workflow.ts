// Order workflow rules.
//
// One place that answers "what may happen to an order next?", so the
// production board, the dashboard and the order detail screen can never
// disagree about the pipeline (previously each screen had its own map,
// two of which skipped SEWING and design approval).

import type { Order, ProductionStatus, ShippingStatus } from '../types';

export const PRODUCTION_STATUSES: ProductionStatus[] = [
  'WAITING_VALIDATION',
  'PRODUCTION_QUEUE',
  'DESIGN',
  'DESIGN_APPROVAL',
  'DESIGN_REVISION',
  'DESIGN_APPROVED',
  'CUTTING',
  'SEWING',
  'PRINTING',
  'QC',
  'REWORK',
  'PACKING',
  'READY_TO_SHIP',
];

export const SHIPPING_STATUSES: ShippingStatus[] = ['NOT_SHIPPED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];

export interface NextStep {
  next: ProductionStatus;
  label: string;
}

const NEXT_STEP: Partial<Record<ProductionStatus, NextStep>> = {
  WAITING_VALIDATION: { next: 'DESIGN', label: 'Validasi → Desain' },
  PRODUCTION_QUEUE: { next: 'DESIGN', label: 'Kirim ke Desain' },
  DESIGN: { next: 'DESIGN_APPROVAL', label: 'Ajukan Persetujuan' },
  DESIGN_APPROVAL: { next: 'DESIGN_APPROVED', label: 'Tandai Disetujui' },
  DESIGN_REVISION: { next: 'DESIGN_APPROVAL', label: 'Ajukan Ulang' },
  DESIGN_APPROVED: { next: 'CUTTING', label: 'Mulai Potong Bahan' },
  CUTTING: { next: 'SEWING', label: 'Lanjut ke Jahit' },
  SEWING: { next: 'PRINTING', label: 'Kirim ke Sablon' },
  PRINTING: { next: 'QC', label: 'Pindah ke QC' },
  QC: { next: 'PACKING', label: 'Lolos QC → Packing' },
  REWORK: { next: 'QC', label: 'Kembali ke QC' },
  PACKING: { next: 'READY_TO_SHIP', label: 'Tandai Siap Kirim' },
};

/** The single forward step from a status, or null when the pipeline ends there. */
export function getNextProductionStep(status: ProductionStatus): NextStep | null {
  return NEXT_STEP[status] ?? null;
}

/**
 * Orders that have physically left the workshop no longer belong on the
 * production board: shipping has started or finished.
 */
export function isOnProductionBoard(order: Pick<Order, 'shippingStatus'>): boolean {
  return order.shippingStatus === 'NOT_SHIPPED';
}

/** An order is "in production" once validated and until it is ready to ship. */
export function isInProduction(order: Pick<Order, 'productionStatus' | 'shippingStatus'>): boolean {
  return (
    order.shippingStatus === 'NOT_SHIPPED' &&
    order.productionStatus !== 'WAITING_VALIDATION' &&
    order.productionStatus !== 'PRODUCTION_QUEUE' &&
    order.productionStatus !== 'READY_TO_SHIP'
  );
}

export function isNewOrder(order: Pick<Order, 'productionStatus'>): boolean {
  return order.productionStatus === 'WAITING_VALIDATION' || order.productionStatus === 'PRODUCTION_QUEUE';
}

export interface StatusChange {
  productionStatus: ProductionStatus;
  shippingStatus: ShippingStatus;
  trackingNumber?: string;
}

/**
 * Business rules for saving production + shipping fields together.
 * Returns an Indonesian error message, or null when the change is valid.
 */
export function validateStatusChange(change: StatusChange): string | null {
  const shippingStarted = change.shippingStatus !== 'NOT_SHIPPED';

  if (shippingStarted && change.productionStatus !== 'READY_TO_SHIP') {
    return 'Pesanan hanya bisa dikirim setelah tahap produksi "Siap Kirim". Ubah tahap produksi terlebih dahulu.';
  }

  const needsTracking = change.shippingStatus === 'SHIPPED' || change.shippingStatus === 'IN_TRANSIT';
  if (needsTracking && !(change.trackingNumber ?? '').trim()) {
    return 'Nomor resi wajib diisi sebelum status pengiriman diubah menjadi Dikirim / Dalam Perjalanan.';
  }

  return null;
}
