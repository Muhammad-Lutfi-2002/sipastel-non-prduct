import React, { useState, useEffect, useRef } from 'react';
import { X, Search, CheckCircle2, Truck, MessageCircle, Clock, Copy, Check, Wallet } from 'lucide-react';
import { Order, ProductionStatus } from '../types';
import { trackOrder, getStoredStudioProfile, StudioProfile } from '../utils/storage';
import { formatDate, formatIDR } from '../utils/formatters';
import { createWhatsAppUrl } from '../utils/whatsapp';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOrderId?: string;
  onWhatsAppInquiry?: (message: string) => void;
}

const MAX_FAILED_LOOKUPS = 5;
const LOOKUP_LOCK_MS = 30_000;

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen,
  onClose,
  defaultOrderId,
  onWhatsAppInquiry,
}) => {
  const [orderIdQuery, setOrderIdQuery] = useState(defaultOrderId || '');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [studioProfile, setStudioProfile] = useState<StudioProfile | null>(null);
  const [selectedPercentage, setSelectedPercentage] = useState<number>(100);
  const [isAccountCopied, setIsAccountCopied] = useState(false);
  const failedLookupsRef = useRef(0);
  const lockedUntilRef = useRef(0);

  useEffect(() => {
    getStoredStudioProfile().then(setStudioProfile);
  }, []);

  // Escape + scroll lock only while the modal is open.
  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdQuery.trim() || !phoneQuery.trim()) {
      setSearchError('Order ID dan nomor HP wajib diisi untuk keamanan data Anda.');
      return;
    }

    // Client-side brake against guessing order IDs / phone numbers. It only
    // slows casual abuse down; real rate limiting must live server-side.
    if (lockedUntilRef.current > Date.now()) {
      const seconds = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      setSearchError(`Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const result = await trackOrder(orderIdQuery.trim(), phoneQuery.trim());
    setSearchedOrder(result);
    setHasSearched(true);
    setIsSearching(false);
    setSelectedPercentage(100);

    if (result) {
      failedLookupsRef.current = 0;
    } else {
      failedLookupsRef.current += 1;
      if (failedLookupsRef.current >= MAX_FAILED_LOOKUPS) {
        lockedUntilRef.current = Date.now() + LOOKUP_LOCK_MS;
        failedLookupsRef.current = 0;
      }
    }
  };

  // Full 9 Pipeline Stages mandated by specification
  const pipelineStages = [
    {
      id: 'ORDER_RECEIVED',
      label: 'Order Received',
      labelId: 'Pesanan Diterima',
      desc: 'Your order has been recorded into our workshop queue.',
    },
    {
      id: 'PAYMENT',
      label: 'Payment Confirmed',
      labelId: 'Pembayaran Terverifikasi',
      desc: 'Down payment or invoice payment verified by finance.',
    },
    {
      id: 'DESIGN',
      label: 'Design & Mockup',
      labelId: 'Validasi Grafis & Mockup',
      desc: 'Vector resolution, scale, and color separations checked.',
    },
    {
      id: 'APPROVAL',
      label: 'Design Approval',
      labelId: 'Persetujuan Mockup Klien',
      desc: 'Digital proof approved by client for manufacturing.',
    },
    {
      id: 'PRODUCTION',
      label: 'In Production',
      labelId: 'Lini Cutting & Produksi',
      desc: 'Fabric cutting, screen-printing, embroidery, or sublimation.',
    },
    {
      id: 'QC',
      label: 'Quality Control',
      labelId: 'Pemeriksaan Jahitan & QC',
      desc: 'Checking thread precision, print alignment, and sizing tolerance.',
    },
    {
      id: 'PACKING',
      label: 'Steam & Packing',
      labelId: 'Finishing & Packaging',
      desc: 'Garment steam ironing and boxed with SIPASTEL identity packaging.',
    },
    {
      id: 'SHIPPING',
      label: 'Dispatched / In Transit',
      labelId: 'Pengiriman Kurir',
      desc: 'Handed over to courier service from Bogor.',
    },
    {
      id: 'DELIVERED',
      label: 'Delivered',
      labelId: 'Pesanan Diterima',
      desc: 'Order safely received by the customer.',
    },
  ];

  // Map internal order status to 0..8 stage index
  const getStageIndex = (order: Order): number => {
    if (order.shippingStatus === 'DELIVERED' || order.shippingStatus === 'COMPLETED') return 8;
    if (order.shippingStatus === 'SHIPPED' || order.shippingStatus === 'IN_TRANSIT') return 7;

    switch (order.productionStatus) {
      case 'PACKING':
      case 'READY_TO_SHIP':
        return 6;
      case 'QC':
      case 'REWORK':
        return 5;
      case 'PRINTING':
      case 'SEWING':
      case 'CUTTING':
        return 4;
      case 'DESIGN_APPROVED':
        return 3;
      case 'DESIGN':
      case 'DESIGN_APPROVAL':
      case 'DESIGN_REVISION':
        return 2;
      case 'PRODUCTION_QUEUE':
      case 'WAITING_VALIDATION':
        return order.paymentStatus !== 'BELUM_BAYAR' ? 2 : 1;
      default:
        return 0;
    }
  };

  const currentStageIndex = searchedOrder ? getStageIndex(searchedOrder) : 0;

  return (
    <div
      id="order-status-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        id="order-status-modal-content"
        className="bg-paper text-ink w-full max-w-2xl rounded-[2px] shadow-2xl border border-line relative my-auto p-5 sm:p-8 max-h-[90vh] overflow-y-auto animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sage-soft" />
            <h2 className="font-heading text-xl font-bold tracking-tight">
              Lacak Status Pesanan
            </h2>
          </div>
          <button
            id="close-order-status-btn"
            onClick={onClose}
            className="p-1.5 text-body hover:text-ink cursor-pointer"
            aria-label="Tutup pelacakan pesanan"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="mb-4 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <input
                id="order-tracking-input"
                type="text"
                value={orderIdQuery}
                onChange={(e) => setOrderIdQuery(e.target.value)}
                placeholder="Order ID (contoh: SPS-20260905-182)"
                className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
              />
              <Search className="w-4 h-4 text-muted absolute left-3 top-3.5" />
            </div>
            <input
              id="order-tracking-phone-input"
              type="tel"
              value={phoneQuery}
              onChange={(e) => setPhoneQuery(e.target.value)}
              placeholder="Nomor HP saat pesan (untuk verifikasi)"
              className="w-full min-h-[44px] px-3 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>
          {searchError && <p className="text-[11px] text-danger">{searchError}</p>}
          <button
            id="track-order-submit-btn"
            type="submit"
            disabled={isSearching}
            className="w-full min-h-[44px] px-5 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all hover:-translate-y-[1px] active:scale-[0.98] shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Mencari...' : 'Lacak Pesanan'}
          </button>
        </form>

        {/* Empty Search Result */}
        {hasSearched && !searchedOrder && (
          <div className="p-8 text-center bg-surface-hover rounded-[2px] border border-line text-xs text-body space-y-2 animate-fade-in">
            <p className="font-heading text-base font-bold text-ink">Pesanan Tidak Ditemukan</p>
            <p>Pastikan nomor Order ID Anda sudah sesuai (contoh: SPS-20260905-182).</p>
            <p>Baru saja memesan? Sistem memerlukan 5–10 menit untuk sinkronisasi antrean workshop.</p>
          </div>
        )}

        {searchedOrder && (
          <div className="space-y-6 animate-fade-in">
            {/* Order Overview Header */}
            <div className="p-4 bg-surface-hover rounded-[2px] border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-widest text-muted block">
                  ORDER ID
                </span>
                <span className="font-mono text-base font-bold text-ink">
                  {searchedOrder.orderId}
                </span>
                <p className="text-xs text-body mt-0.5">
                  Pemesan: <strong>{searchedOrder.customer}</strong> • {formatDate(searchedOrder.createdAt)}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] uppercase font-bold tracking-widest text-muted block">
                  STATUS PRODUKSI
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-sage">
                  {pipelineStages[currentStageIndex]?.labelId}
                </span>
                <p className="text-xs text-muted mt-0.5">
                  {searchedOrder.quantity} pcs total
                </p>
              </div>
            </div>

            {/* Payment Info: percentage picker + bank account transfer details */}
            {(searchedOrder.totalPrice ?? 0) > 0 && searchedOrder.remainingBalance > 0 && (
              <div className="p-4 bg-surface-hover rounded-[2px] border border-line space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-sage-soft" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ink">
                    Info Pembayaran
                  </h3>
                </div>

                <div>
                  <p className="text-[11px] text-body mb-2">
                    Sisa tagihan: <strong>{formatIDR(searchedOrder.remainingBalance)}</strong>. Pilih berapa persen
                    yang ingin Anda bayar sekarang:
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSelectedPercentage(pct)}
                        className={`py-2 rounded-[2px] text-[11px] font-bold border cursor-pointer transition-colors ${
                          selectedPercentage === pct
                            ? 'bg-accent text-on-accent border-accent'
                            : 'bg-surface border-line-strong text-ink hover:border-accent'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 p-2.5 bg-surface border border-line rounded-[2px] flex items-center justify-between">
                    <span className="text-[11px] text-body">Nominal yang perlu ditransfer:</span>
                    <span className="text-sm font-bold text-ink font-mono">
                      {formatIDR(Math.round((searchedOrder.remainingBalance * selectedPercentage) / 100))}
                    </span>
                  </div>
                </div>

                {studioProfile?.bankAccountNumber && (
                  <div className="p-2.5 bg-surface border border-line rounded-[2px] flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-muted">
                        Transfer ke {studioProfile.bankName}
                      </p>
                      <p className="text-sm font-bold font-mono text-ink">
                        {studioProfile.bankAccountNumber}
                      </p>
                      <p className="text-[11px] text-body">a.n. {studioProfile.bankAccountHolder}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(studioProfile.bankAccountNumber);
                        setIsAccountCopied(true);
                        setTimeout(() => setIsAccountCopied(false), 2000);
                      }}
                      className="p-2 text-body hover:text-ink cursor-pointer shrink-0"
                      aria-label="Salin nomor rekening"
                      title="Salin nomor rekening"
                    >
                      {isAccountCopied ? (
                        <Check className="w-4 h-4 text-sage" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  Setelah transfer, konfirmasi via WhatsApp di bawah agar pembayaran Anda segera dicatat oleh tim
                  studio.
                </p>
              </div>
            )}

            {/* Complete 9 Stage Progression Pipeline */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink">
                  Status Progression Pipeline
                </h3>
                <span className="text-[11px] text-muted font-mono">
                  Step {currentStageIndex + 1} of {pipelineStages.length}
                </span>
              </div>

              <div className="space-y-2 border-l-2 border-line ml-2.5 pl-4 sm:pl-5 py-1">
                {pipelineStages.map((stage, idx) => {
                  const isDone = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div
                      key={stage.id}
                      className={`relative p-3 rounded-[2px] border transition-all ${
                        isCurrent
                          ? 'bg-paper border-accent ring-1 ring-accent shadow-xs'
                          : isDone
                          ? 'bg-surface-hover border-line text-body'
                          : 'bg-paper border-line opacity-60 text-muted'
                      }`}
                    >
                      {/* Circle Dot Marker on the vertical pipeline line */}
                      <div className="absolute -left-[23px] sm:-left-[27px] top-3.5 bg-paper p-0.5 rounded-full">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-sage" />
                        ) : isCurrent ? (
                          <div className="w-4 h-4 rounded-full border-2 border-accent flex items-center justify-center bg-paper">
                            <div className="w-2 h-2 rounded-full bg-sage animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-line-strong bg-paper" />
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isCurrent ? 'text-ink' : ''}`}>
                              {isDone ? '✓ ' : isCurrent ? '● ' : '○ '}
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-widest bg-accent text-on-accent rounded-[1px]">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted mt-0.5">
                            {stage.desc}
                          </p>
                        </div>

                        {isDone && (
                          <span className="text-[11px] text-sage font-medium shrink-0">
                            Selesai
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct WhatsApp Support */}
            <div className="pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-muted border-t border-line">
              <span>Ingin revisi detail atau informasi jadwal kurir?</span>
              <button
                onClick={() => {
                  const msg = `Hi SIPASTEL, saya ingin konfirmasi progres pesanan ID: ${searchedOrder.orderId}`;
                  if (onWhatsAppInquiry) onWhatsAppInquiry(msg);
                  window.open(createWhatsAppUrl(msg), '_blank');
                }}
                className="font-bold text-ink hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-sage-soft" />
                <span>Chat Customer Support →</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
