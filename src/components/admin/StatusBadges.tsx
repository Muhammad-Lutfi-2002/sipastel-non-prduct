import React from 'react';
import type { Order } from '../../types';
import { formatProductionStatusLabel, formatPaymentStatusLabel } from '../../utils/formatters';

const BASE = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium';

const TONES = {
  success: { wrap: 'bg-sage/10 text-sage', dot: 'bg-sage' },
  warning: { wrap: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  danger: { wrap: 'bg-danger/10 text-danger', dot: 'bg-danger' },
  info: { wrap: 'bg-info/10 text-info', dot: 'bg-info' },
} as const;

const Badge: React.FC<{ tone: keyof typeof TONES; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`${BASE} ${TONES[tone].wrap}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${TONES[tone].dot}`} aria-hidden="true" />
    {children}
  </span>
);

/** Belum Bayar -> DP Dibayar -> Lunas */
export const PaymentBadge: React.FC<{ status: Order['paymentStatus'] }> = ({ status }) => {
  const tone = status === 'LUNAS' ? 'success' : status === 'DP_DIBAYAR' ? 'warning' : 'danger';
  return <Badge tone={tone}>{formatPaymentStatusLabel(status)}</Badge>;
};

export const ProductionBadge: React.FC<{ status: Order['productionStatus'] }> = ({ status }) => {
  if (status === 'READY_TO_SHIP') return <Badge tone="success">Siap Kirim</Badge>;
  if (status === 'WAITING_VALIDATION' || status === 'PRODUCTION_QUEUE') {
    return <Badge tone="warning">{formatProductionStatusLabel(status)}</Badge>;
  }
  return <Badge tone="info">{formatProductionStatusLabel(status)}</Badge>;
};
