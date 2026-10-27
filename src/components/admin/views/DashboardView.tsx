import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  Scissors,
  Truck,
  ArrowUpRight,
  RefreshCw,
  Inbox,
  TrendingUp,
  TrendingDown,
  FileText,
  Package,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Order, ProductionStatus } from '../../../types';
import { updateStoredOrderStatus, fetchValidPaymentsSince } from '../../../utils/storage';
import { formatDate, formatIDR, formatShippingStatusLabel, getGreeting, formatProductionStatusLabel } from '../../../utils/formatters';
import { getNextProductionStep, isInProduction, isOnProductionBoard } from '../../../utils/workflow';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { useOrders } from '../../../hooks/useOrders';
import { AdminTableSkeleton } from '../../Skeleton';
import { useAdminToast } from '../AdminToast';
import { PaymentBadge, ProductionBadge } from '../StatusBadges';
import { LoadErrorBanner } from '../LoadErrorBanner';
import {
  AdminButton,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SegmentedControl,
  StatCard,
  StatGridSkeleton,
  SkeletonBlock,
  buttonClass,
  cn,
} from '../ui';

const DAY_LABELS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const DashboardView: React.FC = () => {
  const { orders, isLoading, isRefreshing, error, refresh, patchOrder } = useOrders();
  const { user, hasPermission } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useAdminToast();

  const canSeeFinance = hasPermission('finance:read');
  const canAdvance = hasPermission('production:write');

  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d'>('7d');
  const [activeMetricTab, setActiveMetricTab] = useState<'orders' | 'revenue' | 'production'>('orders');
  const [activeHoverPoint, setActiveHoverPoint] = useState<number | null>(null);
  const [payments, setPayments] = useState<{ paidAt: string; amount: number }[]>([]);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Reset the hovered chart point whenever the timeframe changes so a stale
  // index from a longer series (e.g. 30d) can't point past the end of a
  // shorter one (7d) and crash the tooltip lookup.
  useEffect(() => {
    setActiveHoverPoint(null);
  }, [selectedTimeframe, activeMetricTab]);

  // Roles without finance access never see the revenue tab; make sure a
  // stale selection can't leave them on it.
  useEffect(() => {
    if (!canSeeFinance && activeMetricTab === 'revenue') setActiveMetricTab('orders');
  }, [canSeeFinance, activeMetricTab]);

  // Revenue is attributed to the day the money arrived (payments ledger),
  // not to the day the order was created.
  useEffect(() => {
    if (!canSeeFinance) return;
    let cancelled = false;
    const numDays = selectedTimeframe === '7d' ? 7 : 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (numDays - 1));
    fetchValidPaymentsSince(start.toISOString()).then((res) => {
      if (cancelled) return;
      setPayments(res.data);
      setPaymentsError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeFinance, selectedTimeframe]);

  // Highlighted order for the Production Tracking timeline
  const [selectedTimelineOrderId, setSelectedTimelineOrderId] = useState<string>('');

  const timelineCandidates = useMemo(() => orders.filter(isOnProductionBoard).slice(0, 30), [orders]);

  useEffect(() => {
    setSelectedTimelineOrderId((prev) => {
      if (prev && orders.some((o) => o.orderId === prev)) return prev;
      return (
        timelineCandidates.find((o) => o.isCustomOrder)?.orderId || timelineCandidates[0]?.orderId || orders[0]?.orderId || ''
      );
    });
  }, [orders, timelineCandidates]);

  const activeTimelineOrder = useMemo(
    () => orders.find((o) => o.orderId === selectedTimelineOrderId),
    [orders, selectedTimelineOrderId]
  );

  const handleRefresh = async () => {
    const ok = await refresh();
    if (!ok) showToast('Gagal memperbarui dashboard. Data lama tetap ditampilkan.', 'error');
  };

  // KPI metrics, all derived from the orders actually loaded.
  const totalOrders = orders.length;
  const pendingPayment = orders.filter((o) => o.paymentStatus !== 'LUNAS' && (o.totalPrice ?? 0) > 0).length;
  const inProduction = orders.filter(isInProduction).length;
  const readyToShip = orders.filter((o) => o.productionStatus === 'READY_TO_SHIP' && o.shippingStatus === 'NOT_SHIPPED').length;

  // Real month-over-month trend for the "Total Pesanan" card (replaces the
  // hard-coded "+12%" that used to be shown here).
  const monthTrend = useMemo(() => {
    const now = new Date();
    const thisMonth = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    }).length;
    const pct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
    return { thisMonth, lastMonth, pct };
  }, [orders]);

  // Production Tracking stages definition
  const productionStages = [
    { key: 'DESIGN', label: 'Desain' },
    { key: 'APPROVAL', label: 'Persetujuan' },
    { key: 'CUTTING', label: 'Potong Bahan' },
    { key: 'SEWING', label: 'Jahit' },
    { key: 'PRINTING', label: 'Sablon/Bordir' },
    { key: 'QC', label: 'QC' },
    { key: 'PACKING', label: 'Packing' },
  ];

  // Derive stage index for the active order
  const getStageState = (stageKey: string, currentStatus: ProductionStatus) => {
    const stageOrder = ['DESIGN', 'APPROVAL', 'CUTTING', 'SEWING', 'PRINTING', 'QC', 'PACKING', 'READY_TO_SHIP'];

    let activeIdx = 0;
    if (currentStatus === 'WAITING_VALIDATION' || currentStatus === 'PRODUCTION_QUEUE') activeIdx = 0;
    else if (currentStatus === 'DESIGN' || currentStatus === 'DESIGN_REVISION') activeIdx = 0;
    else if (currentStatus === 'DESIGN_APPROVAL' || currentStatus === 'DESIGN_APPROVED') activeIdx = 1;
    else if (currentStatus === 'CUTTING') activeIdx = 2;
    else if (currentStatus === 'SEWING') activeIdx = 3;
    else if (currentStatus === 'PRINTING') activeIdx = 4;
    else if (currentStatus === 'QC' || currentStatus === 'REWORK') activeIdx = 5;
    else if (currentStatus === 'PACKING') activeIdx = 6;
    else if (currentStatus === 'READY_TO_SHIP') activeIdx = 7;

    const thisIdx = stageOrder.indexOf(stageKey);

    if (thisIdx < activeIdx) return 'completed';
    if (thisIdx === activeIdx) return 'current';
    return 'waiting';
  };

  // Moves the highlighted order one step along the SAME pipeline the
  // production board uses (workflow.ts), for users allowed to do so. The
  // screen is rolled back if the database refuses the change.
  const nextStep = activeTimelineOrder && isOnProductionBoard(activeTimelineOrder)
    ? getNextProductionStep(activeTimelineOrder.productionStatus)
    : null;

  const handleAdvanceActiveOrder = async () => {
    if (!activeTimelineOrder || !nextStep || isAdvancing) return;
    const previous = activeTimelineOrder.productionStatus;
    setIsAdvancing(true);
    patchOrder(activeTimelineOrder.orderId, { productionStatus: nextStep.next });
    const result = await updateStoredOrderStatus(activeTimelineOrder.orderId, nextStep.next);
    setIsAdvancing(false);
    if (result.success) {
      showToast(`${activeTimelineOrder.orderId} dipindahkan ke ${formatProductionStatusLabel(nextStep.next)}.`, 'success');
    } else {
      patchOrder(activeTimelineOrder.orderId, { productionStatus: previous });
      showToast(result.error ?? 'Gagal memindahkan pesanan.', 'error');
    }
  };

  // Analytics chart data, bucketed by calendar day over the selected
  // timeframe (last 7 or last 30 days from today).
  const chartData = useMemo(() => {
    const numDays = selectedTimeframe === '7d' ? 7 : 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: { day: string; orders: number; revenue: number; volume: number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const bucketDate = new Date(today);
      bucketDate.setDate(today.getDate() - i);
      const label =
        numDays === 7 ? DAY_LABELS_ID[bucketDate.getDay()] : `${bucketDate.getDate()}/${bucketDate.getMonth() + 1}`;

      const ordersOnDay = orders.filter((o) => sameLocalDay(new Date(o.createdAt), bucketDate));
      const paidOnDay = payments.filter((p) => sameLocalDay(new Date(p.paidAt), bucketDate));

      buckets.push({
        day: label,
        orders: ordersOnDay.length,
        revenue: paidOnDay.reduce((sum, p) => sum + p.amount, 0),
        // Pieces of orders received that day that are currently in production.
        volume: ordersOnDay.filter(isInProduction).reduce((sum, o) => sum + (o.quantity || 0), 0),
      });
    }
    return buckets;
  }, [orders, payments, selectedTimeframe]);

  // Scales to the actual peak value in the current dataset (with a sensible
  // floor) so the line stays readable whether the studio has 2 orders or 200.
  const maxValue = useMemo(() => {
    const key = activeMetricTab === 'revenue' ? 'revenue' : activeMetricTab === 'production' ? 'volume' : 'orders';
    const peak = Math.max(...chartData.map((d) => d[key]), 0);
    if (peak === 0) return activeMetricTab === 'revenue' ? 1000000 : 5;
    return Math.ceil(peak * 1.2);
  }, [chartData, activeMetricTab]);

  const points = chartData.map((d, i) => {
    const val = activeMetricTab === 'revenue' ? d.revenue : activeMetricTab === 'production' ? d.volume : d.orders;
    // Plot area spans x=20..555, safely inside the 0-580 viewBox.
    const chartLeft = 20;
    const chartRight = 555;
    const x = chartData.length > 1 ? chartLeft + i * ((chartRight - chartLeft) / (chartData.length - 1)) : chartLeft;
    const y = 140 - (val / maxValue) * 110;
    return { x, y, ...d, val };
  });

  const svgPath = points.length > 0 ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}` : '';
  const areaPath =
    points.length > 0 ? `${svgPath} L ${points[points.length - 1].x},150 L ${points[0].x},150 Z` : '';

  // Recent activity feed derived from real orders (most recently created first).
  const activityFeed = useMemo(() => {
    const formatRelativeTime = (iso: string): string => {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'baru saja';
      if (diffMin < 60) return `${diffMin} menit lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} jam lalu`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay} hari lalu`;
    };

    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((o) => ({
        id: o.orderId,
        text: `${o.customer} membuat pesanan${o.isCustomOrder ? ' custom' : ''} baru${
          o.items?.[0]?.productName ? ` untuk ${o.items[0].productName}` : ''
        }.`,
        time: formatRelativeTime(o.createdAt),
        orderId: o.orderId,
      }));
  }, [orders]);

  const goToOrder = (orderId: string) => navigate(`/admin/orders/${encodeURIComponent(orderId)}`);
  const firstName = user?.name?.split(' ')[0] || 'Tim Studio';

  // "Perlu perhatian": orders that are waiting on a person, derived only from
  // the orders already loaded (no extra query, no placeholder data).
  const attentionItems = useMemo(() => {
    type Item = { order: Order; reason: string; tone: 'warning' | 'danger' | 'success' | 'info' };
    const items: Item[] = [];
    const byAge = (a: Order, b: Order) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    [...orders]
      .filter((o) => o.productionStatus === 'WAITING_VALIDATION')
      .sort(byAge)
      .forEach((order) => items.push({ order, reason: 'Menunggu validasi', tone: 'info' }));
    [...orders]
      .filter((o) => o.productionStatus === 'READY_TO_SHIP' && o.shippingStatus === 'NOT_SHIPPED')
      .sort(byAge)
      .forEach((order) => items.push({ order, reason: 'Siap dikirim', tone: 'success' }));
    [...orders]
      .filter((o) => o.paymentStatus !== 'LUNAS' && (o.totalPrice ?? 0) > 0)
      .sort(byAge)
      .forEach((order) =>
        items.push({
          order,
          reason: order.paymentStatus === 'DP_DIBAYAR' ? 'Menunggu pelunasan' : 'Menunggu pembayaran',
          tone: order.paymentStatus === 'DP_DIBAYAR' ? 'warning' : 'danger',
        })
      );
    return items.slice(0, 6);
  }, [orders]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-64" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>
        <StatGridSkeleton />
        <AdminTableSkeleton rows={5} />
      </div>
    );
  }

  const metricOptions = [
    { value: 'orders' as const, label: 'Pesanan' },
    ...(canSeeFinance ? [{ value: 'revenue' as const, label: 'Pendapatan' }] : []),
    { value: 'production' as const, label: 'Produksi' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description="Ringkasan pesanan dan produksi studio hari ini."
        actions={
          <>
            <AdminButton onClick={handleRefresh} disabled={isRefreshing} aria-busy={isRefreshing}>
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-accent')} aria-hidden="true" />
              {isRefreshing ? 'Memperbarui...' : 'Perbarui'}
            </AdminButton>
            <AdminButton variant="primary" onClick={() => navigate('/admin/orders')}>
              Semua Pesanan
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </AdminButton>
          </>
        }
      />

      {/* Quick actions: only the shortcuts this role may actually open. */}
      <div className="flex items-center flex-wrap gap-2" role="group" aria-label="Aksi cepat">
        <span className="text-xs font-medium text-muted mr-1">Aksi cepat</span>
        <button type="button" onClick={() => navigate('/admin/orders?status=new')} className={buttonClass('secondary', 'sm')}>
          <Inbox className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          <span>Pesanan Masuk</span>
        </button>
        {hasPermission('products:write') && (
          <button type="button" onClick={() => navigate('/admin/products')} className={buttonClass('secondary', 'sm')}>
            <Package className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <span>Kelola Produk</span>
          </button>
        )}
        {hasPermission('production:read') && (
          <button type="button" onClick={() => navigate('/admin/production')} className={buttonClass('secondary', 'sm')}>
            <Scissors className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <span>Lihat Produksi</span>
          </button>
        )}
        {hasPermission('invoices:read') && (
          <button type="button" onClick={() => navigate('/admin/invoices')} className={buttonClass('secondary', 'sm')}>
            <FileText className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <span>Lihat Invoice</span>
          </button>
        )}
      </div>

      {error && <LoadErrorBanner message={error} onRetry={handleRefresh} isRetrying={isRefreshing} hasStaleData={orders.length > 0} />}

      {/* KPI row: every number comes from the loaded orders. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Pesanan"
          value={totalOrders}
          icon={ShoppingBag}
          tone="accent"
          onClick={() => navigate('/admin/orders')}
          footer={
            <span className={cn('inline-flex items-center gap-1', monthTrend.pct === null ? 'text-muted' : monthTrend.pct >= 0 ? 'text-sage' : 'text-danger')}>
              {monthTrend.pct !== null && monthTrend.pct < 0 ? (
                <TrendingDown className="w-3 h-3" aria-hidden="true" />
              ) : (
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
              )}
              <span>
                {monthTrend.thisMonth} bulan ini
                {monthTrend.pct !== null && ` (${monthTrend.pct >= 0 ? '+' : ''}${monthTrend.pct}% vs bulan lalu)`}
              </span>
            </span>
          }
        />
        <StatCard
          label="Menunggu Pembayaran"
          value={pendingPayment}
          icon={Clock}
          tone="warning"
          onClick={() => navigate('/admin/orders')}
          footer="Belum lunas"
        />
        <StatCard
          label="Sedang Produksi"
          value={inProduction}
          icon={Scissors}
          tone="info"
          onClick={hasPermission('production:read') ? () => navigate('/admin/production') : undefined}
          footer="Sedang berjalan"
        />
        <StatCard
          label="Siap Kirim"
          value={readyToShip}
          icon={Truck}
          tone="success"
          onClick={() => navigate('/admin/orders?status=ready_to_ship')}
          footer="Menunggu pengiriman"
        />
      </div>

      {/* Needs attention + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader title="Perlu Perhatian" description="Pesanan yang menunggu tindakan Anda." />
          {attentionItems.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Semua beres" description="Tidak ada pesanan yang menunggu tindakan saat ini." />
          ) : (
            <ul className="divide-y divide-line">
              {attentionItems.map(({ order, reason, tone }) => (
                <li key={`${order.orderId}-${reason}`}>
                  <button
                    type="button"
                    onClick={() => goToOrder(order.orderId)}
                    className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left hover:bg-surface-hover/60 transition-colors cursor-pointer focus:outline-none focus-visible:bg-surface-hover"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">{order.customer}</span>
                      <span className="block text-xs text-muted font-mono truncate">{order.orderId}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge tone={tone} dot>
                        {reason}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-5 min-w-0">
          <CardHeader title="Aktivitas Terbaru" description="Pesanan terbaru dari pelanggan." />
          {activityFeed.length === 0 ? (
            <EmptyState icon={Inbox} title="Belum ada aktivitas" description="Pesanan baru akan muncul di sini." />
          ) : (
            <ul className="divide-y divide-line max-h-80 overflow-y-auto">
              {activityFeed.map((act) => (
                <li key={act.id}>
                  <button
                    type="button"
                    onClick={() => goToOrder(act.orderId)}
                    className="block w-full text-left px-4 sm:px-5 py-3 hover:bg-surface-hover/60 transition-colors cursor-pointer focus:outline-none focus-visible:bg-surface-hover"
                  >
                    <p className="text-sm text-ink leading-snug">{act.text}</p>
                    <p className="flex items-center justify-between gap-2 mt-1 text-xs text-muted">
                      <span>{act.time}</span>
                      <span className="text-accent font-medium font-mono truncate">{act.orderId}</span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Production progress for one selected order */}
      <Card>
        <CardHeader
          title="Progres Produksi"
          description={
            activeTimelineOrder ? (
              <>
                <span className="font-mono text-ink">{activeTimelineOrder.orderId}</span> · Customer:{' '}
                <span className="font-medium text-ink">{activeTimelineOrder.customer}</span> •{' '}
                {activeTimelineOrder.items[0]?.productName || activeTimelineOrder.productType || 'Item Custom'} ({activeTimelineOrder.quantity} pcs)
              </>
            ) : (
              'Belum ada pesanan untuk dilacak.'
            )
          }
          action={
            <>
              {timelineCandidates.length > 1 && (
                <select
                  value={selectedTimelineOrderId}
                  onChange={(e) => setSelectedTimelineOrderId(e.target.value)}
                  aria-label="Pilih pesanan untuk dilacak"
                  className="h-8 px-2 bg-surface border border-line-strong rounded-lg text-xs text-body cursor-pointer max-w-44 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {timelineCandidates.map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      {o.orderId} · {o.customer}
                    </option>
                  ))}
                </select>
              )}
              <AdminButton size="sm" variant="ghost" onClick={() => activeTimelineOrder && goToOrder(activeTimelineOrder.orderId)} disabled={!activeTimelineOrder}>
                Detail Pesanan
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </AdminButton>
              {canAdvance && nextStep && (
                <AdminButton size="sm" variant="primary" onClick={handleAdvanceActiveOrder} disabled={isAdvancing} isLoading={isAdvancing}>
                  {nextStep.label} →
                </AdminButton>
              )}
            </>
          }
        />
        <div className="p-4 sm:p-5">
          {/* Desktop: horizontal */}
          <ol className="hidden md:flex items-start justify-between relative" aria-label="Tahap produksi">
            <div className="absolute left-6 right-6 top-3.5 h-px bg-line" aria-hidden="true" />
            {productionStages.map((st, idx) => {
              const state = getStageState(st.key, activeTimelineOrder?.productionStatus ?? 'WAITING_VALIDATION');
              return (
                <li key={st.key} className="flex flex-col items-center relative text-center flex-1" aria-current={state === 'current' ? 'step' : undefined}>
                  <span
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ring-4 ring-surface',
                      state === 'completed' && 'bg-sage text-white',
                      state === 'current' && 'bg-accent text-on-accent',
                      state === 'waiting' && 'bg-surface border border-line-strong text-muted'
                    )}
                  >
                    {state === 'completed' ? '✓' : idx + 1}
                  </span>
                  <span className="text-xs font-medium text-ink mt-2">{st.label}</span>
                  <span className={cn('text-[11px] mt-0.5', state === 'completed' ? 'text-sage' : state === 'current' ? 'text-accent font-medium' : 'text-muted')}>
                    {state === 'completed' ? 'Selesai' : state === 'current' ? 'Berlangsung' : 'Menunggu'}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Mobile: vertical */}
          <ol className="md:hidden space-y-3" aria-label="Tahap produksi">
            {productionStages.map((st, idx) => {
              const state = getStageState(st.key, activeTimelineOrder?.productionStatus ?? 'WAITING_VALIDATION');
              return (
                <li key={st.key} className="flex items-center gap-3" aria-current={state === 'current' ? 'step' : undefined}>
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium',
                      state === 'completed' && 'bg-sage text-white',
                      state === 'current' && 'bg-accent text-on-accent',
                      state === 'waiting' && 'bg-surface border border-line-strong text-muted'
                    )}
                  >
                    {state === 'completed' ? '✓' : idx + 1}
                  </span>
                  <span className="flex-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{st.label}</span>
                    <span className={cn(state === 'completed' ? 'text-sage' : state === 'current' ? 'text-accent font-medium' : 'text-muted')}>
                      {state === 'completed' ? 'Selesai' : state === 'current' ? 'Berlangsung' : 'Menunggu'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      {/* Trend chart */}
      <Card className="min-w-0">
        <CardHeader
          title={selectedTimeframe === '7d' ? 'Performa 7 Hari Terakhir' : 'Performa 30 Hari Terakhir'}
          description="Volume dan tren berdasarkan data pesanan."
          action={
            <>
              <SegmentedControl
                label="Rentang waktu"
                value={selectedTimeframe}
                onChange={setSelectedTimeframe}
                options={[
                  { value: '7d', label: '7 Hari' },
                  { value: '30d', label: '30 Hari' },
                ]}
              />
              <SegmentedControl label="Metrik grafik" value={activeMetricTab} onChange={setActiveMetricTab} options={metricOptions} />
            </>
          }
        />
        <div className="p-4 sm:p-5">
          {paymentsError && activeMetricTab === 'revenue' && (
            <p role="alert" className="text-xs text-danger mb-2">
              Data pendapatan gagal dimuat: {paymentsError}
            </p>
          )}
          <div className="relative overflow-hidden rounded-lg">
            <svg
              viewBox="0 0 580 160"
              className="w-full h-44 overflow-hidden"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Grafik ${activeMetricTab === 'revenue' ? 'pendapatan' : activeMetricTab === 'production' ? 'produksi' : 'pesanan'} ${selectedTimeframe === '7d' ? '7' : '30'} hari terakhir`}
            >
              <line x1="20" y1="30" x2="560" y2="30" stroke="var(--color-line)" strokeDasharray="3 3" />
              <line x1="20" y1="85" x2="560" y2="85" stroke="var(--color-line)" strokeDasharray="3 3" />
              <line x1="20" y1="140" x2="560" y2="140" stroke="var(--color-line)" />
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent-soft)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--color-accent-soft)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#chartAreaGradient)" />
              <path d={svgPath} fill="none" stroke="var(--color-accent-soft)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((pt, idx) => (
                <g key={pt.day} className="cursor-pointer">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={activeHoverPoint === idx ? 5 : 3.5}
                    className="transition-all"
                    fill={activeHoverPoint === idx ? 'var(--color-ink)' : 'var(--color-accent-soft)'}
                    stroke="var(--color-surface)"
                    strokeWidth="2"
                    onMouseEnter={() => setActiveHoverPoint(idx)}
                    onMouseLeave={() => setActiveHoverPoint(null)}
                    onClick={() => setActiveHoverPoint((cur) => (cur === idx ? null : idx))}
                  />
                  {(chartData.length <= 7 || idx % 5 === 0) && (
                    <text x={pt.x} y="155" textAnchor="middle" className="text-[11px] fill-muted font-mono">
                      {pt.day}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {activeHoverPoint !== null && chartData[activeHoverPoint] && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-ink text-paper text-xs rounded-md shadow-lg pointer-events-none flex items-center gap-2">
                <span className="font-mono text-[11px] text-accent">{chartData[activeHoverPoint].day}:</span>
                <span className="font-semibold">
                  {activeMetricTab === 'revenue'
                    ? formatIDR(chartData[activeHoverPoint].revenue)
                    : activeMetricTab === 'production'
                    ? `${chartData[activeHoverPoint].volume} pcs diproduksi`
                    : `${chartData[activeHoverPoint].orders} pesanan`}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader
          title="Pesanan Terbaru"
          description="Pantau permintaan terbaru dari pelanggan."
          action={
            <AdminButton size="sm" variant="ghost" onClick={() => navigate('/admin/orders')}>
              Lihat semua pesanan ({orders.length})
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </AdminButton>
          }
        />
        {orders.length === 0 ? (
          <EmptyState icon={Inbox} title="Belum ada pesanan masuk" description="Pesanan dari pelanggan akan tampil di sini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="py-2.5 px-4 font-medium">Pesanan</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Pelanggan</th>
                  <th scope="col" className="py-2.5 px-3 font-medium hidden md:table-cell">Produk</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Pembayaran</th>
                  <th scope="col" className="py-2.5 px-3 font-medium">Produksi</th>
                  <th scope="col" className="py-2.5 px-3 font-medium hidden xl:table-cell">Pengiriman</th>
                  <th scope="col" className="py-2.5 px-3 font-medium hidden lg:table-cell">Tanggal</th>
                  <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.slice(0, 6).map((order) => (
                  <tr key={order.orderId} onClick={() => goToOrder(order.orderId)} className="group hover:bg-surface-hover/60 transition-colors cursor-pointer">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-ink">{order.orderId}</td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-ink leading-none">{order.customer}</p>
                      <span className="text-xs text-muted mt-1 block">{order.phone}</span>
                    </td>
                    <td className="py-3 px-3 max-w-xs hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Badge tone={order.isCustomOrder ? 'accent' : 'neutral'}>{order.isCustomOrder ? 'Custom' : 'Katalog'}</Badge>
                        <span className="text-ink truncate">{order.items[0]?.productName || order.productType || 'Pakaian'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>
                    <td className="py-3 px-3">
                      <ProductionBadge status={order.productionStatus} />
                    </td>
                    <td className="py-3 px-3 text-xs text-body hidden xl:table-cell">{formatShippingStatusLabel(order.shippingStatus)}</td>
                    <td className="py-3 px-3 text-xs text-muted hidden lg:table-cell">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <AdminButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToOrder(order.orderId);
                        }}
                        aria-label={`Detail pesanan ${order.orderId}`}
                      >
                        Detail
                      </AdminButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
