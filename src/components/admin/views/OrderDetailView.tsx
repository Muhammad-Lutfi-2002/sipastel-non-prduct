import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Save,
  Copy,
  Check,
  Palette,
  Eye,
  X,
  FileImage,
} from 'lucide-react';
import { ProductionStatus, ShippingStatus } from '../../../types';
import { updateOrderDetails, updateOrderPrice, addOrderActivity } from '../../../utils/storage';
import { AdminTableSkeleton } from '../../Skeleton';
import { useAdminToast } from '../AdminToast';
import {
  formatDate,
  formatDateTime,
  formatIDR,
  formatProductionStatusLabel,
  formatShippingStatusLabel,
} from '../../../utils/formatters';
import { createWhatsAppUrl } from '../../../utils/whatsapp';
import { isTrustedAssetUrl, looksLikeImage } from '../../../utils/safeUrl';
import { PRODUCTION_STATUSES, SHIPPING_STATUSES, validateStatusChange } from '../../../utils/workflow';
import { copyTextToClipboard } from '../../../utils/exportXlsx';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { useOrder } from '../../../hooks/useOrder';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { PaymentBadge, ProductionBadge } from '../StatusBadges';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { Badge } from '../ui';
import { PaymentHistoryPanel } from './PaymentHistoryPanel';

interface OrderDetailViewProps {
  orderId: string;
}

const DESIGN_STAGES: ProductionStatus[] = ['DESIGN', 'DESIGN_APPROVAL', 'DESIGN_REVISION'];
const REVISABLE_STAGES: ProductionStatus[] = ['DESIGN', 'DESIGN_APPROVAL', 'DESIGN_APPROVED'];

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ orderId }) => {
  const { navigate } = useRouter();
  const { hasPermission } = useAuth();
  const { showToast } = useAdminToast();
  const { order, activity, isLoading, error, reload } = useOrder(orderId);

  const canEditStatus = hasPermission('production:write');
  const canSetPrice = hasPermission('orders:write:price');
  const canSeeInvoices = hasPermission('invoices:read');

  // Status transition form state
  const [selectedProductionStatus, setSelectedProductionStatus] = useState<ProductionStatus>('WAITING_VALIDATION');
  const [selectedShippingStatus, setSelectedShippingStatus] = useState<ShippingStatus>('NOT_SHIPPED');
  const [trackingNoInput, setTrackingNoInput] = useState('');
  const [courierInput, setCourierInput] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  useEscapeKey(isPreviewModalOpen, () => setIsPreviewModalOpen(false));
  useBodyScrollLock(isPreviewModalOpen);

  // (Re)seed the form whenever the SERVER copy of the order changes, so the
  // form always starts from what is really saved.
  useEffect(() => {
    if (!order) return;
    setSelectedProductionStatus(order.productionStatus);
    setSelectedShippingStatus(order.shippingStatus);
    setTrackingNoInput(order.trackingNumber || '');
    setCourierInput(order.courier || '');
  }, [order?.id, order?.productionStatus, order?.shippingStatus, order?.trackingNumber, order?.courier]);

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-4 bg-surface border border-line rounded-xl my-6" aria-busy="true">
        <AdminTableSkeleton rows={5} />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="max-w-xl mx-auto my-6 space-y-4">
        <LoadErrorBanner message={error} onRetry={() => void reload()} />
        <button
          type="button"
          onClick={() => navigate('/admin/orders')}
          className="h-9 px-4 border border-line-strong bg-surface hover:bg-surface-hover rounded-lg text-sm font-medium text-ink cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Kembali ke Daftar Pesanan
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4 bg-surface border border-line rounded-xl my-6">
        <h2 className="font-heading text-base font-semibold text-ink">Pesanan Tidak Ditemukan</h2>
        <p className="text-sm text-muted">
          Pesanan <span className="font-mono">{orderId}</span> tidak ditemukan dalam catatan studio.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/orders')}
          className="h-9 px-4 bg-accent hover:bg-accent-soft text-on-accent rounded-lg text-sm font-medium cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Kembali ke Daftar Pesanan
        </button>
      </div>
    );
  }

  // --- Design file: only ever link/embed files that live in OUR storage.
  // design_url is written by anonymous customers, so an arbitrary string
  // there must never become a clickable link or an <img> that phones home.
  const designUrl = order.design && isTrustedAssetUrl(order.design) ? order.design : null;
  const hasUntrustedDesign = !!order.design && !designUrl;
  const designIsImage = !!designUrl && looksLikeImage(designUrl);
  const designExtension = (order.designFileName || designUrl || '').split('?')[0].split('.').pop()?.toUpperCase();

  const handleSavePrice = async () => {
    const parsed = Number(priceInput.replace(/[^0-9]/g, ''));
    if (!parsed || parsed <= 0) {
      showToast('Masukkan nominal harga yang valid (lebih besar dari 0).', 'error');
      return;
    }
    if (parsed < (order.totalPaid || 0)) {
      showToast(
        `Harga tidak boleh lebih kecil dari total yang sudah dibayar (${formatIDR(order.totalPaid)}). Batalkan pembayaran terlebih dahulu jika salah catat.`,
        'error'
      );
      return;
    }
    setIsSavingPrice(true);
    const result = await updateOrderPrice(order.orderId, parsed);
    setIsSavingPrice(false);
    if (!result.success) {
      showToast(`Gagal menyimpan harga: ${result.error}`, 'error');
      return;
    }
    setIsEditingPrice(false);
    await reload();
    showToast('Harga pesanan berhasil disimpan.', 'success');
  };

  const handleCopyOrderId = async () => {
    const ok = await copyTextToClipboard(order.orderId);
    if (ok) {
      setCopiedId(true);
      showToast('ID Pesanan disalin ke clipboard.', 'info');
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      showToast('Gagal menyalin ID pesanan.', 'error');
    }
  };

  // Writes the change, then the audit-trail entry. Nothing is shown as
  // saved until the database has confirmed it, and the screen is re-read
  // from the database afterwards - no optimistic state to get out of sync.
  const persistChange = async (params: {
    productionStatus: ProductionStatus;
    shippingStatus: ShippingStatus;
    trackingNumber: string;
    courier: string;
    note: string;
    successMessage: string;
  }): Promise<boolean> => {
    const result = await updateOrderDetails(order.orderId, {
      productionStatus: params.productionStatus,
      shippingStatus: params.shippingStatus,
      trackingNumber: params.trackingNumber,
      courier: params.courier,
    });
    if (!result.success) {
      showToast(`Gagal menyimpan: ${result.error}`, 'error');
      return false;
    }

    const parts: string[] = [];
    if (params.shippingStatus !== order.shippingStatus) {
      parts.push(`Pengiriman: ${formatShippingStatusLabel(order.shippingStatus)} → ${formatShippingStatusLabel(params.shippingStatus)}`);
    }
    if (params.trackingNumber.trim() && params.trackingNumber.trim() !== (order.trackingNumber || '')) {
      parts.push(`Resi: ${params.trackingNumber.trim()}${params.courier.trim() ? ` (${params.courier.trim()})` : ''}`);
    }
    if (params.note.trim()) parts.push(params.note.trim());

    const productionChanged = params.productionStatus !== order.productionStatus;
    if (productionChanged || parts.length > 0) {
      const logResult = await addOrderActivity({
        orderInternalId: order.id,
        previousStatus: order.productionStatus,
        newStatus: params.productionStatus,
        note: parts.join(' • '),
      });
      if (!logResult.success) {
        showToast(`${params.successMessage} Namun catatan riwayat gagal disimpan: ${logResult.error}`, 'info');
        await reload();
        return true;
      }
    }

    await reload();
    showToast(params.successMessage, 'success');
    return true;
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditStatus || isSavingStatus) return;

    const noChange =
      selectedProductionStatus === order.productionStatus &&
      selectedShippingStatus === order.shippingStatus &&
      trackingNoInput.trim() === (order.trackingNumber || '') &&
      courierInput.trim() === (order.courier || '') &&
      !statusNote.trim();
    if (noChange) {
      showToast('Tidak ada perubahan untuk disimpan.', 'info');
      return;
    }

    const problem = validateStatusChange({
      productionStatus: selectedProductionStatus,
      shippingStatus: selectedShippingStatus,
      trackingNumber: trackingNoInput,
    });
    if (problem) {
      showToast(problem, 'error');
      return;
    }

    setIsSavingStatus(true);
    const ok = await persistChange({
      productionStatus: selectedProductionStatus,
      shippingStatus: selectedShippingStatus,
      trackingNumber: trackingNoInput,
      courier: courierInput,
      note: statusNote,
      successMessage: 'Perubahan status dan catatan staf berhasil disimpan.',
    });
    setIsSavingStatus(false);
    if (ok) setStatusNote('');
  };

  const handleApproveMockup = async () => {
    if (!canEditStatus || isSavingStatus) return;
    setIsSavingStatus(true);
    await persistChange({
      productionStatus: 'DESIGN_APPROVED',
      shippingStatus: order.shippingStatus,
      trackingNumber: order.trackingNumber || '',
      courier: order.courier || '',
      note: 'Mockup desain disetujui. Lanjut ke tahap potong bahan.',
      successMessage: 'Mockup desain disetujui. Pesanan siap masuk tahap potong bahan.',
    });
    setIsSavingStatus(false);
  };

  const handleRequestRevision = async () => {
    if (!canEditStatus || isSavingStatus) return;
    setIsSavingStatus(true);
    await persistChange({
      productionStatus: 'DESIGN_REVISION',
      shippingStatus: order.shippingStatus,
      trackingNumber: order.trackingNumber || '',
      courier: order.courier || '',
      note: 'Revisi desain diminta: perlu penyesuaian ulang desain.',
      successMessage: 'Pesanan ditandai untuk Revisi Desain.',
    });
    setIsSavingStatus(false);
  };

  const whatsAppMessage = `Halo ${order.customer}, kami dari SIPASTEL Studio mengenai pesanan Anda (${order.orderId}). Status saat ini: ${formatProductionStatusLabel(order.productionStatus)}. Apakah ada yang bisa kami bantu?`;
  const whatsAppUrl = createWhatsAppUrl(whatsAppMessage, order.phone);

  const canApprove = canEditStatus && order.isCustomOrder && DESIGN_STAGES.includes(order.productionStatus);
  const canRequestRevision = canEditStatus && order.isCustomOrder && REVISABLE_STAGES.includes(order.productionStatus);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {error && <LoadErrorBanner message={error} onRetry={() => void reload()} hasStaleData />}

      {/* Back and Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/admin/orders')}
          className="inline-flex items-center gap-1.5 text-sm text-body hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Kembali ke Semua Pesanan</span>
        </button>

        <span className="text-xs text-muted">Dibuat: {formatDate(order.createdAt)}</span>
      </div>

      {/* Header Banner */}
      <div className="p-4 sm:p-6 bg-surface border border-line rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-mono text-lg sm:text-xl font-semibold text-ink">{order.orderId}</h2>
            <button
              type="button"
              onClick={handleCopyOrderId}
              className="p-1 text-muted hover:text-ink hover:bg-surface-hover rounded transition-colors cursor-pointer"
              title="Salin ID Pesanan"
              aria-label="Salin ID Pesanan"
            >
              {copiedId ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
            </button>

            <Badge tone={order.isCustomOrder ? 'accent' : 'neutral'}>{order.isCustomOrder ? 'Pakaian Custom' : 'Pesanan Katalog'}</Badge>

            <ProductionBadge status={order.productionStatus} />
            <PaymentBadge status={order.paymentStatus} />
          </div>

          <p className="text-sm text-body mt-1">
            Pelanggan: <span className="font-semibold text-ink">{order.customer}</span> • {order.phone}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 bg-sage/10 hover:bg-sage/20 text-sage border border-sage/30 rounded-lg text-xs font-medium flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>WhatsApp Pelanggan</span>
          </a>

          {canSeeInvoices && (
            <button
              type="button"
              onClick={() => navigate('/admin/invoices')}
              className="h-8 px-3 bg-surface hover:bg-surface-hover border border-line-strong text-xs font-medium text-ink rounded-lg flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
              <span>Invoice #{order.invoiceNumber}</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Order Design Mockup */}
      {order.isCustomOrder && (
        <div className="p-4 sm:p-6 bg-surface border border-line rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" aria-hidden="true" />
              <h3 className="font-heading text-sm font-semibold text-ink">Desain &amp; Mockup Pakaian Custom</h3>
            </div>
            <span className="text-xs font-mono text-muted">
              Tahap Desain:{' '}
              {order.productionStatus === 'DESIGN_APPROVED'
                ? 'Disetujui'
                : order.productionStatus === 'DESIGN_REVISION'
                ? 'Sedang Direvisi'
                : DESIGN_STAGES.includes(order.productionStatus)
                ? 'Perlu Ditinjau'
                : 'Lewat tahap desain'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Visual Mockup Box */}
            <div className="md:col-span-4 bg-surface-hover/40 border border-line rounded-lg p-3 flex flex-col items-center justify-center text-center">
              {designUrl && designIsImage ? (
                <button
                  type="button"
                  className="relative group cursor-pointer rounded"
                  onClick={() => setIsPreviewModalOpen(true)}
                  aria-label="Perbesar mockup desain"
                >
                  <img
                    src={designUrl}
                    alt="Mockup desain custom dari pelanggan"
                    className="max-h-52 w-auto object-contain rounded border border-line bg-surface shadow-2xs"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity rounded flex items-center justify-center text-white text-xs font-semibold gap-1">
                    <Eye className="w-4 h-4" aria-hidden="true" />
                    <span>Klik untuk Perbesar</span>
                  </span>
                </button>
              ) : designUrl ? (
                <div className="h-44 w-full flex flex-col items-center justify-center text-body space-y-2">
                  <FileImage className="w-9 h-9 text-muted" aria-hidden="true" />
                  <p className="text-xs font-mono font-semibold text-ink">{designExtension || 'FILE'}</p>
                  <p className="text-xs text-muted px-2">Pratinjau tidak tersedia untuk tipe file ini.</p>
                </div>
              ) : hasUntrustedDesign ? (
                <div className="h-44 w-full flex flex-col items-center justify-center text-warning space-y-2 px-2">
                  <AlertCircle className="w-7 h-7" aria-hidden="true" />
                  <p className="text-xs">Tautan desain berasal dari sumber yang tidak dikenal dan tidak ditampilkan demi keamanan.</p>
                </div>
              ) : (
                <div className="h-44 w-full flex flex-col items-center justify-center text-muted space-y-2">
                  <Palette className="w-8 h-8 text-muted" aria-hidden="true" />
                  <p className="text-xs">Belum ada file desain yang diunggah.</p>
                </div>
              )}
            </div>

            {/* Spec details & Action buttons */}
            <div className="md:col-span-8 space-y-3.5">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted">File Terlampir</span>
                <p className="text-sm font-mono font-semibold text-ink break-all">
                  {order.designFileName || (designUrl ? 'File desain pelanggan' : 'Tidak ada file')}
                </p>
                <p className="text-sm text-body">
                  Jenis Pakaian: <strong className="text-ink">{order.productType || '-'}</strong>
                </p>
              </div>

              {order.notes && (
                <div className="p-3 bg-surface-hover/40 border border-line rounded-lg text-sm space-y-1">
                  <span className="font-semibold text-ink block">Catatan Pelanggan:</span>
                  <p className="text-body leading-relaxed italic whitespace-pre-line">&ldquo;{order.notes}&rdquo;</p>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-2 pt-1">
                {designUrl && (
                  <>
                    {designIsImage && (
                      <button
                        type="button"
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="h-8 px-3 bg-surface hover:bg-surface-hover border border-line-strong text-xs font-medium text-ink rounded-lg flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                        <span>Lihat Resolusi Penuh</span>
                      </button>
                    )}
                    <a
                      href={designUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={order.designFileName || undefined}
                      className="h-8 px-3 bg-surface hover:bg-surface-hover border border-line-strong text-xs font-medium text-ink rounded-lg flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    >
                      {designIsImage ? (
                        <Download className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                      )}
                      <span>{designIsImage ? 'Unduh File' : 'Buka / Unduh File'}</span>
                    </a>
                  </>
                )}

                {canApprove && (
                  <button
                    type="button"
                    onClick={handleApproveMockup}
                    disabled={isSavingStatus}
                    className="px-3.5 py-1.5 bg-sage hover:bg-sage/85 text-on-sage text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Setujui Mockup</span>
                  </button>
                )}

                {canRequestRevision && (
                  <button
                    type="button"
                    onClick={handleRequestRevision}
                    disabled={isSavingStatus}
                    className="px-3 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span>Minta Revisi</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Order Information & Operation Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Order Items & Apparel Specs */}
          <div className="p-4 sm:p-5 bg-surface border border-line rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-heading text-sm font-semibold text-ink">
                Item &amp; Spesifikasi
              </h3>
              <span className="text-xs font-mono font-medium text-muted">
                Total Kuantitas: {order.quantity} pcs
              </span>
            </div>

            <div className="space-y-3 divide-y divide-line">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-ink text-sm">{item.productName}</p>
                    <div className="text-body mt-1 space-y-0.5">
                      {item.size && (
                        <p>
                          Ukuran: <span className="font-mono font-semibold text-ink">{item.size}</span>
                        </p>
                      )}
                      {item.variantColor && (
                        <p>
                          Warna: <span className="text-ink">{item.variantColor}</span>
                        </p>
                      )}
                      {order.material && (
                        <p>
                          Bahan: <span className="text-ink">{order.material}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-xs text-muted">Qty: {item.quantity}</span>
                    {!!item.price && (
                      <p className="font-mono font-semibold text-ink mt-0.5">
                        {formatIDR(item.price * item.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total summary */}
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-medium">
              <span className="text-body">Total Nominal Pesanan:</span>
              {isEditingPrice ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    aria-label="Total harga pesanan"
                    placeholder="Contoh: 1500000"
                    className="w-32 px-2 py-1.5 bg-surface border border-line-strong rounded-lg text-xs font-mono focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={handleSavePrice}
                    disabled={isSavingPrice}
                    className="px-2.5 py-1.5 bg-accent hover:bg-accent-soft disabled:opacity-50 text-on-accent text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {isSavingPrice ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPrice(false)}
                    className="px-2.5 py-1.5 border border-line text-body text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-ink">
                    {order.totalPrice ? formatIDR(order.totalPrice) : 'Belum diatur'}
                  </span>
                  {canSetPrice && (
                    <button
                      type="button"
                      onClick={() => {
                        setPriceInput(order.totalPrice ? String(order.totalPrice) : '');
                        setIsEditingPrice(true);
                      }}
                      className="text-[11px] font-semibold text-warning hover:underline cursor-pointer"
                    >
                      {order.totalPrice ? 'Ubah Harga' : 'Atur Harga'}
                    </button>
                  )}
                </div>
              )}
            </div>
            {!order.totalPrice && !isEditingPrice && (
              <p className="text-[11px] text-danger -mt-1">
                Harga pesanan custom ini belum diatur, sehingga DP/pelunasan belum bisa dicatat. Atur harga dulu di atas.
              </p>
            )}
          </div>

          {/* Customer & Delivery Address */}
          <div className="p-4 sm:p-5 bg-surface border border-line rounded-xl space-y-3.5 text-xs">
            <h3 className="font-heading text-sm font-semibold text-ink border-b border-line pb-2.5">
              Pelanggan &amp; Tujuan Pengiriman
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  Nama Penerima
                </span>
                <p className="font-semibold text-ink">{order.customer}</p>
                <p className="text-body">{order.phone}</p>
                {order.email && <p className="text-muted">{order.email}</p>}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  Alamat Pengiriman
                </span>
                <p className="text-ink leading-relaxed">{order.address}</p>
                <p className="text-muted font-mono">
                  {order.city} {order.postalCode}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-muted">Kurir: {order.courier || '-'}</span>
              <span className="font-mono text-body">
                Resi / Tracking:{' '}
                <strong className="text-ink">{order.trackingNumber || 'Belum ada'}</strong>
              </span>
            </div>
          </div>

          {order.paymentPreference && (
            <div className="p-4 bg-surface-hover border border-line rounded-xl text-xs">
              <span className="text-muted block mb-1">
                Preferensi Pembayaran dari Customer (belum dikonfirmasi)
              </span>
              <p className="font-bold text-ink">
                {order.paymentPreference === 'LUNAS'
                  ? 'Lunas (Bayar Penuh)'
                  : `DP ${order.paymentPreferencePercentage ?? 50}% (Uang Muka)`}
              </p>
            </div>
          )}

          <PaymentHistoryPanel order={order} onPaymentChange={() => void reload()} />
        </div>

        {/* Right Column: Update Status Form & Staff Timeline Logs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-4 sm:p-5 bg-surface border border-line rounded-xl space-y-4">
            <h3 className="font-heading text-sm font-semibold text-ink border-b border-line pb-2.5">Perbarui Status Studio</h3>

            {!canEditStatus && (
              <p role="note" className="text-xs text-muted bg-surface-hover border border-line rounded-lg p-2.5">
                Peran Anda hanya dapat melihat status produksi dan pengiriman.
              </p>
            )}

            <form onSubmit={handleSaveStatus} className="space-y-3.5 text-sm">
              <fieldset disabled={!canEditStatus || isSavingStatus} className="space-y-3.5 min-w-0 disabled:opacity-70">
                <div>
                  <label htmlFor="od-production-status" className="block text-xs font-medium text-heading mb-1.5">
                    Tahap Produksi
                  </label>
                  <select
                    id="od-production-status"
                    value={selectedProductionStatus}
                    onChange={(e) => setSelectedProductionStatus(e.target.value as ProductionStatus)}
                    className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm font-medium text-ink focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors"
                  >
                    {PRODUCTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatProductionStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-xs font-medium text-heading mb-1.5">Pembayaran (Otomatis)</span>
                    <div
                      className={`w-full p-2 rounded-lg text-xs font-bold text-center border ${
                        order.paymentStatus === 'LUNAS'
                          ? 'bg-sage/10 text-sage border-sage/30'
                          : order.paymentStatus === 'DP_DIBAYAR'
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-danger/10 text-danger border-danger/30'
                      }`}
                    >
                      {order.paymentStatus === 'LUNAS' ? 'LUNAS' : order.paymentStatus === 'DP_DIBAYAR' ? 'DP DIBAYAR' : 'BELUM BAYAR'}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="od-shipping-status" className="block text-xs font-medium text-heading mb-1.5">
                      Pengiriman
                    </label>
                    <select
                      id="od-shipping-status"
                      value={selectedShippingStatus}
                      onChange={(e) => setSelectedShippingStatus(e.target.value as ShippingStatus)}
                      className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-xs font-medium text-ink focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors"
                    >
                      {SHIPPING_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {formatShippingStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="od-courier" className="block text-xs font-medium text-heading mb-1.5">
                      Kurir
                    </label>
                    <input
                      id="od-courier"
                      type="text"
                      value={courierInput}
                      onChange={(e) => setCourierInput(e.target.value)}
                      maxLength={60}
                      placeholder="contoh: JNE Reguler"
                      className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="od-tracking" className="block text-xs font-medium text-heading mb-1.5">
                      Nomor Resi
                    </label>
                    <input
                      id="od-tracking"
                      type="text"
                      value={trackingNoInput}
                      onChange={(e) => setTrackingNoInput(e.target.value)}
                      maxLength={60}
                      placeholder="contoh: JNE8921829102"
                      className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm font-mono text-ink focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="od-note" className="block text-xs font-medium text-heading mb-1.5">
                    Catatan Operasional Staf
                  </label>
                  <textarea
                    id="od-note"
                    rows={2}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    maxLength={500}
                    placeholder="Tulis catatan singkat untuk arsip tim..."
                    className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent-soft text-on-accent rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{isSavingStatus ? 'Menyimpan...' : 'Simpan Perubahan Status'}</span>
                </button>
              </fieldset>
            </form>
          </div>

          {/* Production Timeline & Staff Logs (persisted in the database) */}
          <div className="p-4 sm:p-5 bg-surface border border-line rounded-xl space-y-3">
            <h3 className="font-heading text-sm font-semibold text-ink border-b border-line pb-2.5">Riwayat &amp; Log Produksi</h3>

            <div className="space-y-3 max-h-72 overflow-y-auto divide-y divide-line text-sm">
              {activity.length > 0 ? (
                activity.map((log) => (
                  <div key={log.id} className="pt-2.5 first:pt-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-ink font-mono">{formatProductionStatusLabel(log.newStatus)}</span>
                      <span className="text-muted font-mono text-[11px] shrink-0">{formatDateTime(log.timestamp)}</span>
                    </div>
                    {log.note && <p className="text-body text-xs leading-relaxed">{log.note}</p>}
                    <span className="text-[11px] text-muted block font-mono">Oleh: {log.authorName || 'Staf Studio'}</span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-muted text-xs">Belum ada riwayat perubahan status.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mockup Full Resolution Zoom Modal */}
      {isPreviewModalOpen && designUrl && designIsImage && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="design-preview-title"
            className="bg-surface p-4 sm:p-6 rounded-xl max-w-3xl w-full border border-line shadow-2xl space-y-4 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h4 id="design-preview-title" className="font-heading text-sm font-semibold text-ink">
                  {order.designFileName || 'Mockup Pakaian'}
                </h4>
                <p className="text-xs text-muted font-mono">
                  Pesanan: {order.orderId} • Pelanggan: {order.customer}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                aria-label="Tutup pratinjau desain"
                className="p-1 text-muted hover:text-ink rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-surface-hover/40 border border-line rounded-lg p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img src={designUrl} alt="Pratinjau desain pelanggan" className="max-h-[60vh] object-contain rounded" referrerPolicy="no-referrer" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <a
                href={designUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={order.designFileName || undefined}
                className="px-3.5 py-1.5 bg-accent text-on-accent text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Unduh Desain</span>
              </a>
              <button
                type="button"
                autoFocus
                onClick={() => setIsPreviewModalOpen(false)}
                className="h-8 px-3 border border-line-strong text-ink hover:bg-surface-hover text-xs font-medium rounded-lg cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
