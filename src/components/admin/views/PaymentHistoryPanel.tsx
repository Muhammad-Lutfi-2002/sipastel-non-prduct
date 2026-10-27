import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Ban, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';
import { Order, Payment } from '../../../types';
import { fetchPaymentHistory, recordPayment, voidPayment } from '../../../utils/storage';
import { formatIDR, formatDateTime } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { LoadErrorBanner } from '../LoadErrorBanner';

interface PaymentHistoryPanelProps {
  order: Order;
  onPaymentChange: () => void; // called after a successful record/void so the parent can refetch the order
}

const DP_PRESETS = [
  { label: 'DP 20%', value: 0.2 },
  { label: 'DP 30%', value: 0.3 },
  { label: 'DP 50%', value: 0.5 },
] as const;

export const PaymentHistoryPanel: React.FC<PaymentHistoryPanelProps> = ({ order, onPaymentChange }) => {
  const { user, hasPermission } = useAuth();
  const [history, setHistory] = useState<Payment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [dpMode, setDpMode] = useState<'20' | '30' | '50' | 'CUSTOM' | 'PELUNASAN'>('PELUNASAN');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [note, setNote] = useState('');

  const canRecordPayment = hasPermission('orders:write:payment');
  const canVoidPayment = hasPermission('payments:void');

  useEscapeKey(isFormOpen && !isSubmitting, () => setIsFormOpen(false));
  useEscapeKey(!!voidTarget && !isSubmitting, () => setVoidTarget(null));
  useBodyScrollLock(isFormOpen || !!voidTarget);

  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true);
    fetchPaymentHistory(order.id).then((res) => {
      setHistory(res.data);
      setHistoryError(res.error);
      setIsLoadingHistory(false);
    });
  }, [order.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totalPrice = order.totalPrice || 0;
  const remaining = order.remainingBalance;

  // Compute the nominal amount implied by the currently selected DP mode
  const computedAmount = (() => {
    if (dpMode === '20') return Math.round(totalPrice * 0.2);
    if (dpMode === '30') return Math.round(totalPrice * 0.3);
    if (dpMode === '50') return Math.round(totalPrice * 0.5);
    if (dpMode === 'PELUNASAN') return remaining;
    return Number(customAmount.replace(/[^0-9]/g, '')) || 0;
  })();

  const resetForm = () => {
    setDpMode('PELUNASAN');
    setCustomAmount('');
    setPaymentMethod('Bank Transfer');
    setNote('');
    setFormError(null);
  };

  const handleOpenForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) return;
    if (computedAmount <= 0) {
      setFormError('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }
    if (computedAmount > remaining) {
      setFormError(
        `Nominal (${formatIDR(computedAmount)}) melebihi sisa tagihan (${formatIDR(remaining)}). Nominal DP/pembayaran tidak boleh melebihi total tagihan.`
      );
      return;
    }
    if (!order.invoiceId) {
      setFormError('Invoice untuk order ini belum tersedia. Muat ulang halaman dan coba lagi.');
      return;
    }

    const paymentType: Payment['paymentType'] =
      dpMode === '20' || dpMode === '30' || dpMode === '50' ? 'DP' : dpMode === 'PELUNASAN' ? 'PELUNASAN' : 'LAINNYA';

    setIsSubmitting(true);
    const result = await recordPayment({
      orderInternalId: order.id,
      invoiceId: order.invoiceId,
      amount: computedAmount,
      paymentType,
      paymentMethod,
      note: note.trim() || undefined,
      recordedBy: user.id,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Gagal mencatat pembayaran. Coba lagi.');
      return;
    }

    setIsFormOpen(false);
    resetForm();
    loadHistory();
    onPaymentChange();
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget || !user) return;
    if (!voidReason.trim()) {
      setFormError('Alasan pembatalan wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    const result = await voidPayment(voidTarget.paymentId, user.id, voidReason.trim());
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Gagal membatalkan pembayaran.');
      return;
    }

    setVoidTarget(null);
    setVoidReason('');
    setFormError(null);
    loadHistory();
    onPaymentChange();
  };

  const paymentTypeLabel = (t: Payment['paymentType']) =>
    t === 'DP' ? 'DP' : t === 'PELUNASAN' ? 'Pelunasan' : 'Lainnya';

  return (
    <div className="bg-surface border border-line rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-body" />
          <h3 className="font-heading text-sm font-bold text-ink">Riwayat Pembayaran</h3>
        </div>
        {canRecordPayment && (
          <button
            type="button"
            onClick={handleOpenForm}
            disabled={totalPrice <= 0}
            title={totalPrice <= 0 ? 'Atur harga pesanan terlebih dahulu di atas sebelum mencatat pembayaran.' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed text-on-accent text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat Pembayaran
          </button>
        )}
      </div>

      {/* Summary strip: Total Tagihan / Total Dibayar / Sisa / Persentase */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-paper border border-line rounded-lg">
          <p className="text-[11px] font-mono uppercase text-muted mb-0.5">Total Tagihan</p>
          <p className="text-sm font-bold text-ink">{formatIDR(totalPrice)}</p>
        </div>
        <div className="p-3 bg-sage/10 border border-sage/30 rounded-lg">
          <p className="text-[11px] font-mono uppercase text-sage mb-0.5">Total Dibayar</p>
          <p className="text-sm font-bold text-sage">{formatIDR(order.totalPaid)}</p>
        </div>
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
          <p className="text-[11px] font-mono uppercase text-danger mb-0.5">Sisa Pembayaran</p>
          <p className="text-sm font-bold text-danger">{formatIDR(remaining)}</p>
        </div>
        <div className="p-3 bg-paper border border-line rounded-lg">
          <p className="text-[11px] font-mono uppercase text-muted mb-0.5">Persentase</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-ink">{order.paymentPercentage.toFixed(0)}%</p>
            <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
              <div
                className="h-full bg-sage transition-all"
                style={{ width: `${Math.min(order.paymentPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {historyError && <LoadErrorBanner message={historyError} onRetry={loadHistory} hasStaleData={history.length > 0} />}

      {/* Timeline of payments */}
      {isLoadingHistory ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-hover rounded-lg animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-4 h-4 text-muted" />
          </div>
          <p className="text-xs text-muted">Belum ada pembayaran tercatat untuk order ini.</p>
        </div>
      ) : (
        <ol className="relative border-l border-line ml-2 space-y-5">
          {history.map((p) => (
            <li key={p.paymentId} className="ml-4">
              <span
                className={`absolute -left-[7px] w-3 h-3 rounded-full border-2 border-surface ${
                  p.status === 'VOID' ? 'bg-danger' : 'bg-sage'
                }`}
              />
              <div className={`p-3 rounded-lg border ${p.status === 'VOID' ? 'bg-danger/10 border-danger/30 opacity-70' : 'bg-paper border-line'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                        p.paymentType === 'DP'
                          ? 'bg-warning/10 text-warning'
                          : p.paymentType === 'PELUNASAN'
                          ? 'bg-sage/10 text-sage'
                          : 'bg-surface-hover text-body'
                      }`}
                    >
                      {paymentTypeLabel(p.paymentType)}
                    </span>
                    <span className={`text-sm font-bold ${p.status === 'VOID' ? 'line-through text-danger' : 'text-ink'}`}>
                      {formatIDR(p.amount)}
                    </span>
                    {p.status === 'VOID' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-danger uppercase">
                        <Ban className="w-3 h-3" /> Dibatalkan
                      </span>
                    )}
                  </div>
                  {canVoidPayment && p.status === 'VALID' && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidTarget(p);
                        setVoidReason('');
                        setFormError(null);
                      }}
                      className="text-[11px] font-semibold text-danger hover:underline cursor-pointer"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-1">
                  {p.paymentMethod} &middot; {formatDateTime(p.paidAt)}
                  {p.recordedByName && <> &middot; dicatat oleh {p.recordedByName}</>}
                </p>
                {p.note && <p className="text-[11px] text-body mt-1 italic">"{p.note}"</p>}
                {p.status === 'VOID' && p.voidReason && (
                  <p className="text-[11px] text-danger mt-1.5 pt-1.5 border-t border-danger/30">
                    <span className="font-semibold">Alasan pembatalan:</span> {p.voidReason}
                    {p.voidedByName && <> &middot; oleh {p.voidedByName}</>}
                    {p.voidedAt && <> &middot; {formatDateTime(p.voidedAt)}</>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Record Payment Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setIsFormOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Catat pembayaran baru"
            onSubmit={handleSubmitPayment}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-sm font-bold text-ink">Catat Pembayaran Baru</h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Tutup"
                className="text-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDpMode('20')}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dpMode === '20' ? 'bg-accent text-on-accent border-accent' : 'bg-paper border-line text-ink'
                }`}
              >
                DP 20%
              </button>
              <button
                type="button"
                onClick={() => setDpMode('30')}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dpMode === '30' ? 'bg-accent text-on-accent border-accent' : 'bg-paper border-line text-ink'
                }`}
              >
                DP 30%
              </button>
              <button
                type="button"
                onClick={() => setDpMode('50')}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dpMode === '50' ? 'bg-accent text-on-accent border-accent' : 'bg-paper border-line text-ink'
                }`}
              >
                DP 50%
              </button>
              <button
                type="button"
                onClick={() => setDpMode('PELUNASAN')}
                className={`col-span-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dpMode === 'PELUNASAN' ? 'bg-accent text-on-accent border-accent' : 'bg-paper border-line text-ink'
                }`}
              >
                Pelunasan ({formatIDR(remaining)})
              </button>
              <button
                type="button"
                onClick={() => setDpMode('CUSTOM')}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dpMode === 'CUSTOM' ? 'bg-accent text-on-accent border-accent' : 'bg-paper border-line text-ink'
                }`}
              >
                Manual
              </button>
            </div>

            {/* Live preview of the nominal amount implied by the selected preset */}
            {dpMode !== 'CUSTOM' && dpMode !== 'PELUNASAN' && (
              <p className="text-[11px] text-muted -mt-1">Nominal: {formatIDR(computedAmount)}</p>
            )}

            {dpMode === 'CUSTOM' && (
              <div>
                <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                  Nominal Pembayaran
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Contoh: 500000"
                  className="w-full p-2.5 bg-paper border border-line rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                <p className="text-[11px] text-muted mt-1">
                  Maksimal {formatIDR(remaining)} (sisa tagihan saat ini).
                </p>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase text-muted mb-1">Metode Pembayaran</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-paper border border-line rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <option>Bank Transfer</option>
                <option>QRIS</option>
                <option>Cash</option>
                <option>E-Wallet</option>
                <option>Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-muted mb-1">Catatan (opsional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-paper border border-line rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none"
                placeholder="Contoh: transfer dari rekening a.n. customer"
              />
            </div>

            <div className="p-2.5 bg-surface-hover rounded-lg text-xs text-body flex items-center justify-between">
              <span>Nominal yang akan dicatat:</span>
              <span className="font-bold text-ink">{formatIDR(computedAmount)}</span>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-2.5 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-accent hover:bg-accent-soft disabled:opacity-50 text-on-accent text-xs font-bold uppercase tracking-wide rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? 'Menyimpan...' : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simpan Pembayaran
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Void confirmation modal */}
      {voidTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setVoidTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Batalkan pembayaran"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="font-heading text-sm font-bold">Batalkan Pembayaran</h4>
            </div>
            <p className="text-xs text-body">
              Anda akan membatalkan pembayaran <strong>{formatIDR(voidTarget.amount)}</strong> ({paymentTypeLabel(voidTarget.paymentType)}, {formatDateTime(voidTarget.paidAt)}).
              Data transaksi asli akan tetap tersimpan sebagai rekam jejak, hanya statusnya berubah menjadi dibatalkan.
            </p>
            <div>
              <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                Alasan Pembatalan (wajib diisi)
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-paper border border-line rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 resize-none"
                placeholder="Contoh: salah input nominal, seharusnya Rp500.000"
              />
            </div>
            {formError && <p className="text-xs text-danger">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="flex-1 py-2.5 border border-line text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-danger hover:bg-danger/80 disabled:opacity-50 text-ink-soft text-xs font-bold rounded-lg cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
