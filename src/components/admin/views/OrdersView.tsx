import React, { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, Download, Link2, X, ShoppingBag } from 'lucide-react';
import { Order } from '../../../types';
import { formatDate, formatIDR, formatProductionStatusLabel } from '../../../utils/formatters';
import { PRODUCTION_STATUSES, isNewOrder } from '../../../utils/workflow';
import { exportRowsToXlsx, copyTextToClipboard } from '../../../utils/exportXlsx';
import { useRouter } from '../../../context/RouterContext';
import { useOrders } from '../../../hooks/useOrders';
import { AdminTableSkeleton } from '../../Skeleton';
import { useAdminToast } from '../AdminToast';
import { PaymentBadge, ProductionBadge } from '../StatusBadges';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { Pagination } from '../Pagination';
import { AdminButton, Badge, Card, EmptyState, PageHeader, cn, inputClass } from '../ui';

const PAGE_SIZE = 25;

type TabId = 'ALL' | 'NEW' | 'CUSTOM' | 'CATALOG' | 'PENDING' | 'PRODUCTION' | 'READY_TO_SHIP';

// The active tab lives in the URL (?status=...) so filters survive a page
// refresh, work with the browser's back button and can be bookmarked/shared.
const STATUS_PARAM_TO_TAB: Record<string, TabId> = {
  new: 'NEW',
  custom: 'CUSTOM',
  catalog: 'CATALOG',
  pending: 'PENDING',
  production: 'PRODUCTION',
  ready_to_ship: 'READY_TO_SHIP',
};
const TAB_TO_STATUS_PARAM: Record<TabId, string | null> = {
  ALL: null,
  NEW: 'new',
  CUSTOM: 'custom',
  CATALOG: 'catalog',
  PENDING: 'pending',
  PRODUCTION: 'production',
  READY_TO_SHIP: 'ready_to_ship',
};

function matchesTab(o: Order, tab: TabId): boolean {
  switch (tab) {
    case 'NEW':
      return isNewOrder(o);
    case 'CUSTOM':
      return o.isCustomOrder;
    case 'CATALOG':
      return !o.isCustomOrder;
    case 'PENDING':
      return o.paymentStatus !== 'LUNAS';
    case 'PRODUCTION':
      return !isNewOrder(o) && o.productionStatus !== 'READY_TO_SHIP' && o.shippingStatus !== 'COMPLETED';
    case 'READY_TO_SHIP':
      return o.productionStatus === 'READY_TO_SHIP';
    default:
      return true;
  }
}

export const OrdersView: React.FC = () => {
  const { orders, isLoading, isRefreshing, error, truncated, refresh } = useOrders();
  const { searchParams, navigate } = useRouter();
  const { showToast } = useAdminToast();

  const activeTab: TabId = STATUS_PARAM_TO_TAB[searchParams.get('status') ?? ''] ?? 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [productionFilter, setProductionFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Any change to the filters starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, paymentFilter, productionFilter]);

  const selectTab = (tab: TabId) => {
    const param = TAB_TO_STATUS_PARAM[tab];
    navigate(param ? `/admin/orders?status=${param}` : '/admin/orders', { replace: true, scroll: false });
  };

  const handleRefresh = async () => {
    const ok = await refresh();
    if (ok) showToast('Daftar pesanan diperbarui.', 'info');
    else showToast('Gagal memperbarui pesanan. Data lama tetap ditampilkan.', 'error');
  };

  const handleCopyOrderLink = async () => {
    const ok = await copyTextToClipboard(`${window.location.origin}/custom-order`);
    showToast(
      ok ? 'Link form pesanan custom disalin. Bagikan ke pelanggan.' : 'Gagal menyalin link. Salin manual dari: /custom-order',
      ok ? 'success' : 'error'
    );
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        o.orderId.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        // Digits-only comparison so "0812 3456" finds "0812-3456".
        (qDigits.length >= 3 && o.phone.replace(/\D/g, '').includes(qDigits)) ||
        (!!o.email && o.email.toLowerCase().includes(q)) ||
        (!!o.productType && o.productType.toLowerCase().includes(q));

      const matchesPayment = paymentFilter === 'ALL' || o.paymentStatus === paymentFilter;
      const matchesProduction = productionFilter === 'ALL' || o.productionStatus === productionFilter;

      return matchesSearch && matchesTab(o, activeTab) && matchesPayment && matchesProduction;
    });
  }, [orders, searchQuery, activeTab, paymentFilter, productionFilter]);

  const tabCounts = useMemo(() => {
    const count = (tab: TabId) => orders.filter((o) => matchesTab(o, tab)).length;
    return {
      ALL: orders.length,
      NEW: count('NEW'),
      CUSTOM: count('CUSTOM'),
      CATALOG: count('CATALOG'),
      PENDING: count('PENDING'),
      PRODUCTION: count('PRODUCTION'),
      READY_TO_SHIP: count('READY_TO_SHIP'),
    };
  }, [orders]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportExcel = async () => {
    try {
      await exportRowsToXlsx(
        filteredOrders.map((o) => ({
          'Order ID': o.orderId,
          Customer: o.customer,
          Phone: o.phone,
          Type: o.isCustomOrder ? 'Custom' : 'Catalog',
          Total: o.totalPrice || 0,
          Payment: o.paymentStatus,
          Production: o.productionStatus,
          Date: o.createdAt,
          Qty: o.quantity,
          Dibayar: o.totalPaid ?? 0,
          'Sisa Tagihan': o.remainingBalance ?? 0,
          Pengiriman: o.shippingStatus,
        })),
        {
          sheetName: 'Orders',
          fileName: `sipastel-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
          columnWidths: [22, 20, 16, 10, 14, 14, 18, 22, 8, 14, 14, 16],
        }
      );
      showToast(`${filteredOrders.length} pesanan berhasil diekspor ke Excel.`, 'success');
    } catch (e) {
      console.error('Excel export failed:', e);
      showToast('Gagal mengekspor ke Excel. Coba lagi.', 'error');
    }
  };

  const goToOrder = (orderId: string) => navigate(`/admin/orders/${encodeURIComponent(orderId)}`);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'ALL', label: 'Semua Pesanan' },
    { id: 'NEW', label: 'Baru / Antrean' },
    { id: 'CUSTOM', label: 'Pesanan Custom' },
    { id: 'CATALOG', label: 'Katalog' },
    { id: 'PENDING', label: 'Menunggu Pembayaran' },
    { id: 'PRODUCTION', label: 'Sedang Produksi' },
    { id: 'READY_TO_SHIP', label: 'Siap Kirim' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <PageHeader title="Semua Pesanan" />
        <AdminTableSkeleton rows={8} />
      </div>
    );
  }

  const selectClass = cn(inputClass, 'w-full sm:w-auto cursor-pointer');
  const noOrdersYet = orders.length === 0 && !error;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Semua Pesanan"
        description="Pantau pesanan pelanggan, alur produksi, dan pengiriman."
        actions={
          <>
            <AdminButton onClick={handleExportExcel}>
              <Download className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
              Ekspor Excel
            </AdminButton>
            <AdminButton onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('w-3.5 h-3.5 text-muted', isRefreshing && 'animate-spin')} aria-hidden="true" />
              Perbarui
            </AdminButton>
            {/* Staff cannot open the public Custom Studio while signed in, so
                instead of a dead-end "create order" button we offer the link
                that customers use to place their own order. */}
            <AdminButton variant="primary" onClick={handleCopyOrderLink}>
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              Salin Link Form Pesanan
            </AdminButton>
          </>
        }
      />

      {error && <LoadErrorBanner message={error} onRetry={handleRefresh} isRetrying={isRefreshing} hasStaleData={orders.length > 0} />}

      {truncated && (
        <div role="status" className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
          Menampilkan pesanan terbaru saja (batas 2.000). Pesanan yang lebih lama tidak ikut dihitung di tab dan ekspor.
        </div>
      )}

      {/* Status tabs (underline style) */}
      <div role="tablist" aria-label="Filter pesanan" className="flex items-center gap-1 overflow-x-auto border-b border-line scrollbar-none">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'relative px-3 h-10 text-[13px] whitespace-nowrap font-medium transition-colors cursor-pointer flex items-center gap-2',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t-md',
                selected ? 'text-ink' : 'text-muted hover:text-ink'
              )}
            >
              <span>{tab.label}</span>
              <span className={cn('px-1.5 rounded-full text-[11px] tabular-nums', selected ? 'bg-accent-wash text-accent' : 'bg-surface-hover text-body')}>
                {tabCounts[tab.id]}
              </span>
              {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari pesanan"
            placeholder="Cari ID pesanan, customer, HP..."
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

        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filter status pembayaran" className={selectClass}>
            <option value="ALL">Pembayaran: Semua</option>
            <option value="LUNAS">Lunas</option>
            <option value="DP_DIBAYAR">DP Dibayar</option>
            <option value="BELUM_BAYAR">Belum Bayar</option>
          </select>

          <select value={productionFilter} onChange={(e) => setProductionFilter(e.target.value)} aria-label="Filter tahap produksi" className={selectClass}>
            <option value="ALL">Produksi: Semua</option>
            {PRODUCTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatProductionStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-line bg-surface-hover/50 text-muted text-xs">
                <th scope="col" className="py-2.5 px-4 font-medium">ID Pesanan</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Customer</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Spesifikasi</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Qty</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Total Harga</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Pembayaran</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Tahap Produksi</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Dibuat</th>
                <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={noOrdersYet ? ShoppingBag : Search}
                      title={noOrdersYet ? 'Belum ada pesanan masuk.' : 'Tidak ada pesanan ditemukan.'}
                      description={noOrdersYet ? 'Pesanan dari pelanggan akan muncul di sini.' : 'Coba ubah kata kunci pencarian atau filter yang digunakan.'}
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((order) => (
                  <tr key={order.orderId} onClick={() => goToOrder(order.orderId)} className="group hover:bg-surface-hover/60 transition-colors cursor-pointer">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToOrder(order.orderId);
                        }}
                        className="font-mono text-xs font-semibold text-ink hover:text-accent cursor-pointer text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {order.orderId}
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-ink">{order.customer}</p>
                      <span className="text-xs text-muted block mt-0.5">{order.phone}</span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-2">
                        <Badge tone={order.isCustomOrder ? 'accent' : 'neutral'}>{order.isCustomOrder ? 'Custom' : 'Katalog'}</Badge>
                        <span className="text-ink truncate">{order.items[0]?.productName || order.productType || 'Apparel'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-ink tabular-nums">{order.quantity} pcs</td>

                    <td className="py-3 px-4 font-medium text-ink tabular-nums">
                      {order.totalPrice ? formatIDR(order.totalPrice) : <span className="text-muted font-normal">Belum dihargai</span>}
                    </td>

                    <td className="py-3 px-4">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>

                    <td className="py-3 px-4">
                      <ProductionBadge status={order.productionStatus} />
                    </td>

                    <td className="py-3 px-4 text-xs text-muted">{formatDate(order.createdAt)}</td>

                    <td className="py-3 px-4 text-right">
                      <AdminButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToOrder(order.orderId);
                        }}
                      >
                        Detail
                      </AdminButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-line space-y-2.5">
          <p className="text-xs text-muted">
            Menampilkan <strong className="text-ink">{filteredOrders.length}</strong> dari <strong className="text-ink">{orders.length}</strong> pesanan
          </p>
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredOrders.length} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
};
