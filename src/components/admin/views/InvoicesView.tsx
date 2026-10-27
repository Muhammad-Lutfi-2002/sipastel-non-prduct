import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Printer, Eye, X, Search } from 'lucide-react';
import { Order } from '../../../types';
import { getStoredStudioProfile, StudioProfile, FALLBACK_STUDIO_PROFILE } from '../../../utils/storage';
import { AdminTableSkeleton } from '../../Skeleton';
import { formatDate, formatIDR, formatPaymentStatusLabel } from '../../../utils/formatters';
import { useOrders } from '../../../hooks/useOrders';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { PaymentBadge } from '../StatusBadges';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { Pagination } from '../Pagination';
import { AdminButton, Badge, Card, EmptyState, PageHeader, cn, inputClass } from '../ui';

const PAGE_SIZE = 25;

export const InvoicesView: React.FC = () => {
  const { orders, isLoading, isRefreshing, error, refresh } = useOrders();
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [studio, setStudio] = useState<StudioProfile>(FALLBACK_STUDIO_PROFILE);

  useEscapeKey(!!selectedInvoiceOrder, () => setSelectedInvoiceOrder(null));
  useBodyScrollLock(!!selectedInvoiceOrder);

  // The printed invoice carries the studio's real name, address and bank
  // account (from Settings) so a customer can actually pay it.
  useEffect(() => {
    let cancelled = false;
    getStoredStudioProfile().then((profile) => {
      if (!cancelled) setStudio(profile);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.invoiceNumber.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <PageHeader title="Tagihan & Invoice" />
        <AdminTableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tagihan & Invoice"
        description="Buku besar tagihan resmi, bukti pembayaran, dan cetakan invoice pelanggan."
        actions={<Badge tone="neutral">{orders.length} invoice</Badge>}
      />

      {error && <LoadErrorBanner message={error} onRetry={() => void refresh()} isRetrying={isRefreshing} hasStaleData={orders.length > 0} />}

      <div className="relative w-full sm:max-w-sm">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          aria-label="Cari invoice"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nomor invoice, pelanggan, ID pesanan..."
          className={cn(inputClass, 'pl-9 pr-8')}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Invoices Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-hover/50 text-muted text-xs">
                <th scope="col" className="py-2.5 px-4 font-medium">Invoice #</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Ref Pesanan</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Pelanggan</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Tanggal Terbit</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Metode</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Nominal</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Status</th>
                <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={FileText}
                      title={orders.length === 0 && !error ? 'Belum ada invoice.' : 'Tidak ada invoice ditemukan.'}
                      description={
                        orders.length === 0 && !error
                          ? 'Invoice dibuat otomatis untuk setiap pesanan.'
                          : 'Tidak ada invoice yang cocok dengan pencarian Anda.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((order) => (
                  <tr key={order.orderId} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-ink">#{order.invoiceNumber}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-body">{order.orderId}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-ink">{order.customer}</p>
                      <span className="text-xs text-muted">{order.phone}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted">{formatDate(order.createdAt)}</td>
                    <td className="py-3.5 px-4 text-body">{order.paymentMethod || '-'}</td>
                    <td className="py-3.5 px-4 font-medium text-ink tabular-nums">
                      {order.totalPrice ? formatIDR(order.totalPrice) : <span className="text-muted font-normal">Belum dihargai</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <AdminButton size="sm" onClick={() => setSelectedInvoiceOrder(order)}>
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>Lihat</span>
                      </AdminButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-line">
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredOrders.length} onPageChange={setPage} />
        </div>
      </Card>

      {/* Invoice Viewer Modal */}
      {selectedInvoiceOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => setSelectedInvoiceOrder(null)}
        >
          <div
            id="printable-invoice-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-dialog-title"
            className="bg-surface p-6 sm:p-8 rounded-xl max-w-2xl w-full border border-line shadow-2xl space-y-6 animate-modal-content max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                <div>
                  <h3 id="invoice-dialog-title" className="font-heading font-semibold text-base text-ink">
                    Invoice {studio.name}
                  </h3>
                  <span className="text-xs font-mono text-muted">
                    #{selectedInvoiceOrder.invoiceNumber}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-8 px-3 bg-surface hover:bg-surface-hover border border-line-strong rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Printer className="w-3.5 h-3.5 text-body" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setSelectedInvoiceOrder(null)}
                  aria-label="Tutup pratinjau invoice"
                  className="p-1.5 text-muted hover:text-ink rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Issuer */}
            {(studio.address || studio.phone) && (
              <div className="text-xs text-body -mt-2">
                {studio.address && <p>{studio.address}</p>}
                {studio.phone && <p className="font-mono">WhatsApp: {studio.phone}</p>}
              </div>
            )}

            {/* Bill To & Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  Ditagihkan Kepada
                </span>
                <p className="font-semibold text-ink">{selectedInvoiceOrder.customer}</p>
                <p className="text-body">{selectedInvoiceOrder.phone}</p>
                <p className="text-body">{selectedInvoiceOrder.address}</p>
                <p className="text-muted">
                  {selectedInvoiceOrder.city} {selectedInvoiceOrder.postalCode}
                </p>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-xs font-medium text-muted">
                  Metadata Invoice
                </span>
                <p className="font-mono text-ink">
                  Tanggal: {formatDate(selectedInvoiceOrder.createdAt)}
                </p>
                <p className="font-mono text-body">ID Pesanan: {selectedInvoiceOrder.orderId}</p>
                <p
                  className={`font-mono font-semibold ${
                    selectedInvoiceOrder.paymentStatus === 'LUNAS'
                      ? 'text-sage'
                      : selectedInvoiceOrder.paymentStatus === 'DP_DIBAYAR'
                      ? 'text-warning'
                      : 'text-danger'
                  }`}
                >
                  Status: {formatPaymentStatusLabel(selectedInvoiceOrder.paymentStatus)}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-line rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-surface-hover/50 border-b border-line text-muted text-xs">
                  <tr>
                    <th className="p-3">Deskripsi Item</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Harga Satuan</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(selectedInvoiceOrder.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="p-3 font-semibold text-ink">
                        {item.productName}
                        {item.size && (
                          <span className="font-mono text-muted ml-1 font-normal">
                            ({item.size})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">
                        {item.price ? formatIDR(item.price) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-ink">
                        {item.price ? formatIDR(item.price * item.quantity) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total, payments and balance */}
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between font-bold text-ink pb-2 border-b border-line">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-accent">
                    {selectedInvoiceOrder.totalPrice ? formatIDR(selectedInvoiceOrder.totalPrice) : 'Belum dihargai'}
                  </span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Sudah Dibayar:</span>
                  <span className="font-mono">{formatIDR(selectedInvoiceOrder.totalPaid || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink">
                  <span>Sisa Tagihan:</span>
                  <span className="font-mono">{formatIDR(selectedInvoiceOrder.remainingBalance || 0)}</span>
                </div>
              </div>
            </div>

            {selectedInvoiceOrder.paymentStatus !== 'LUNAS' && studio.bankName && studio.bankAccountNumber && (
              <div className="p-3 bg-paper border border-line rounded-lg text-sm space-y-0.5">
                <span className="text-xs font-medium text-muted block">Pembayaran via Transfer</span>
                <p className="text-ink font-semibold">
                  {studio.bankName} <span className="font-mono">{studio.bankAccountNumber}</span>
                </p>
                {studio.bankAccountHolder && <p className="text-body">a.n. {studio.bankAccountHolder}</p>}
              </div>
            )}

            <div className="p-3 bg-paper border border-line rounded-lg text-center text-xs text-muted">
              Invoice diterbitkan oleh sistem produksi {studio.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
