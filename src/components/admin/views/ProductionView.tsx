import React, { useState, useRef } from 'react';
import {
  Scissors,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Clock,
  Palette,
  Printer,
  Package,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Order, ProductionStatus } from '../../../types';
import { updateStoredOrderStatus } from '../../../utils/storage';
import { formatProductionStatusLabel } from '../../../utils/formatters';
import { getNextProductionStep, isOnProductionBoard } from '../../../utils/workflow';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { useOrders } from '../../../hooks/useOrders';
import { AdminTableSkeleton } from '../../Skeleton';
import { useAdminToast } from '../AdminToast';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { AdminButton, Badge, PageHeader, SegmentedControl, cn } from '../ui';

// The board re-fetches by itself so several people watching it stay in sync.
const BOARD_REFRESH_MS = 60_000;

export const ProductionView: React.FC = () => {
  const { orders, isLoading, isRefreshing, error, refresh, patchOrder } = useOrders({ pollMs: BOARD_REFRESH_MS });
  const { searchParams, navigate } = useRouter();
  const { hasPermission } = useAuth();
  const { showToast } = useAdminToast();
  const canAdvance = hasPermission('production:write');

  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Stage filter lives in the URL (?stage=design) so it survives refresh/back.
  const stageParam = searchParams.get('stage');
  const activeStageFilter: string = stageParam === 'design' || stageParam === 'qc' ? stageParam : 'ALL';

  const setStageFilter = (stage: 'ALL' | 'design' | 'qc') => {
    navigate(stage === 'ALL' ? '/admin/production' : `/admin/production?stage=${stage}`, {
      replace: true,
      scroll: false,
    });
  };

  const handleRefresh = async () => {
    const ok = await refresh();
    if (!ok) showToast('Gagal memperbarui papan produksi. Data lama tetap ditampilkan.', 'error');
  };

  // Move one order one step forward. The screen updates immediately, and is
  // put back if the database refuses (permissions, network, ...) - it must
  // never keep showing a stage that was not actually saved.
  const advanceStage = async (order: Order, nextStatus: ProductionStatus) => {
    if (!canAdvance) {
      showToast('Peran Anda tidak memiliki izin memindahkan tahap produksi.', 'error');
      return;
    }
    if (advancingId) return;

    const previousStatus = order.productionStatus;
    setAdvancingId(order.orderId);
    patchOrder(order.orderId, { productionStatus: nextStatus });

    const result = await updateStoredOrderStatus(order.orderId, nextStatus);
    setAdvancingId(null);

    if (result.success) {
      showToast(`Pesanan ${order.orderId} dipindahkan ke ${formatProductionStatusLabel(nextStatus)}.`, 'success');
    } else {
      patchOrder(order.orderId, { productionStatus: previousStatus });
      showToast(result.error ?? 'Gagal memindahkan pesanan.', 'error');
    }
  };

  // Workshop stages pipeline in sequential tracking order
  const stages: {
    id: string;
    stepNumber: string;
    title: string;
    icon: React.ElementType;
    description: string;
    accentColor: string;
    matcher: (o: Order) => boolean;
  }[] = [
    {
      id: 'validation',
      stepNumber: '01',
      title: 'Antrean & Peninjauan',
      icon: Clock,
      description: 'Verifikasi ukuran pola & brief',
      accentColor: 'var(--color-muted)',
      matcher: (o) => o.productionStatus === 'WAITING_VALIDATION' || o.productionStatus === 'PRODUCTION_QUEUE',
    },
    {
      id: 'design',
      stepNumber: '02',
      title: 'Desain & Mockup',
      icon: Palette,
      description: 'Vektorisasi desain & persetujuan',
      accentColor: 'var(--color-accent-soft)',
      matcher: (o) =>
        o.productionStatus === 'DESIGN' ||
        o.productionStatus === 'DESIGN_APPROVAL' ||
        o.productionStatus === 'DESIGN_REVISION' ||
        o.productionStatus === 'DESIGN_APPROVED',
    },
    {
      id: 'cutting_sewing',
      stepNumber: '03',
      title: 'Potong Bahan & Jahit',
      icon: Scissors,
      description: 'Pemotongan kain & perakitan jahitan',
      accentColor: 'var(--color-warning)',
      matcher: (o) => o.productionStatus === 'CUTTING' || o.productionStatus === 'SEWING',
    },
    {
      id: 'printing',
      stepNumber: '04',
      title: 'Sablon Sublimasi',
      icon: Printer,
      description: 'Heat-press & heat transfer printing',
      accentColor: 'var(--color-info)',
      matcher: (o) => o.productionStatus === 'PRINTING',
    },
    {
      id: 'qc',
      stepNumber: '05',
      title: 'Quality Control',
      icon: CheckCircle2,
      description: 'Pemeriksaan dimensi & pembersihan benang',
      accentColor: 'var(--color-sage)',
      matcher: (o) => o.productionStatus === 'QC' || o.productionStatus === 'REWORK',
    },
    {
      id: 'packing',
      stepNumber: '06',
      title: 'Packing & Siap Kirim',
      icon: Package,
      description: 'Setrika, pemberian tag & pengemasan',
      accentColor: 'var(--color-info)',
      matcher: (o) => o.productionStatus === 'PACKING' || o.productionStatus === 'READY_TO_SHIP',
    },
  ];

  const displayedStages = activeStageFilter === 'ALL'
    ? stages
    : stages.filter((st) => st.id === activeStageFilter);

  // Horizontal scroll helpers
  const scrollHorizontal = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollOffset = 360;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollOffset : scrollOffset,
        behavior: 'smooth',
      });
    }
  };

  const scrollToStage = (stageId: string) => {
    setStageFilter('ALL');
    setTimeout(() => {
      const stageElem = document.getElementById(`lane-${stageId}`);
      if (stageElem && scrollContainerRef.current) {
        const containerLeft = scrollContainerRef.current.getBoundingClientRect().left;
        const elemLeft = stageElem.getBoundingClientRect().left;
        scrollContainerRef.current.scrollBy({
          left: elemLeft - containerLeft - 16,
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  // Orders that already left the workshop (shipping started) no longer
  // belong on the board.
  const boardOrders = orders.filter(isOnProductionBoard);

  // Pipeline summary: everything on the board that is not yet ready to ship.
  const activeOrders = boardOrders.filter((o) => o.productionStatus !== 'READY_TO_SHIP');
  const totalOrdersInProduction = activeOrders.length;
  const totalGarments = activeOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in" aria-busy="true">
        <PageHeader title="Alur Pelacakan Produksi" />
        <AdminTableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Alur Pelacakan Produksi"
        description="Alur pelacakan berkelanjutan dari tinjauan ukuran awal hingga pengemasan akhir."
        actions={
          <>
            <Badge tone="accent" className="hidden md:inline-flex">
              <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} aria-hidden="true" />
              Diperbarui otomatis tiap 1 menit
            </Badge>
            <SegmentedControl
              label="Filter lini produksi"
              value={activeStageFilter as 'ALL' | 'design' | 'qc'}
              onChange={setStageFilter}
              options={[
                { value: 'ALL', label: 'Semua Lini' },
                { value: 'design', label: 'Desain' },
                { value: 'qc', label: 'QC' },
              ]}
            />
            {activeStageFilter === 'ALL' && (
              <div className="flex items-center bg-surface border border-line rounded-lg">
                <button
                  type="button"
                  onClick={() => scrollHorizontal('left')}
                  className="h-8 w-8 flex items-center justify-center text-body hover:text-ink hover:bg-surface-hover rounded-l-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  title="Geser ke kiri"
                  aria-label="Geser ke kiri"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollHorizontal('right')}
                  className="h-8 w-8 flex items-center justify-center text-body hover:text-ink hover:bg-surface-hover rounded-r-lg border-l border-line transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  title="Geser ke kanan"
                  aria-label="Geser ke kanan"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
            <AdminButton onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('w-3.5 h-3.5 text-muted', isRefreshing && 'animate-spin')} aria-hidden="true" />
              <span className="hidden md:inline">Perbarui</span>
              <span className="md:hidden sr-only">Perbarui</span>
            </AdminButton>
          </>
        }
      />

      {error && <LoadErrorBanner message={error} onRetry={handleRefresh} isRetrying={isRefreshing} hasStaleData={orders.length > 0} />}

      {/* Pipeline summary: click a stage to jump to its lane */}
      <section aria-label="Ringkasan alur kerja" className="bg-surface border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line text-xs">
          <p className="text-muted">
            <span className="font-medium text-ink">Urutan alur kerja</span> · Klik tahap mana pun untuk lompat ke sana
          </p>
          <p className="flex items-center gap-3 text-body">
            <span>
              Dalam Alur: <strong className="text-ink">{totalOrdersInProduction}</strong> pesanan
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Total Volume: <strong className="text-ink">{totalGarments}</strong> pcs
            </span>
          </p>
        </div>

        <div className="overflow-x-auto pt-3 pb-1">
          <div className="flex items-center min-w-[760px] gap-2">
            {stages.map((st, idx) => {
              const StageIcon = st.icon;
              const count = boardOrders.filter(st.matcher).length;
              const pieces = orders.filter(st.matcher).reduce((sum, o) => sum + (o.quantity || 0), 0);
              const isLast = idx === stages.length - 1;

              return (
                <React.Fragment key={st.id}>
                  <button
                    type="button"
                    onClick={() => scrollToStage(st.id)}
                    className="flex-1 min-w-[110px] p-2.5 rounded-lg border border-line bg-paper hover:bg-surface-hover transition-colors text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-medium text-muted group-hover:text-accent">Tahap {st.stepNumber}</span>
                      <span className="min-w-5 h-5 px-1 rounded-full bg-surface border border-line-strong flex items-center justify-center text-[11px] font-medium text-ink tabular-nums">
                        {count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StageIcon className="w-3.5 h-3.5 text-body group-hover:text-accent shrink-0" aria-hidden="true" />
                      <p className="text-xs font-medium text-ink truncate">{st.title}</p>
                    </div>
                    <p className="text-[11px] text-muted mt-1 truncate">{pieces} pcs aktif</p>
                  </button>
                  {!isLast && <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* Board */}
      <div
        ref={scrollContainerRef}
        className="flex items-start gap-4 overflow-x-auto pb-4 pt-1 scroll-smooth select-text"
        style={{ scrollbarWidth: 'thin' }}
      >
        {displayedStages.map((stage, idx) => {
          const StageIcon = stage.icon;
          const stageOrders = boardOrders.filter(stage.matcher);
          const totalStagePcs = stageOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

          return (
            <section
              key={stage.id}
              id={`lane-${stage.id}`}
              aria-label={`Lane ${stage.title}`}
              className="w-[320px] sm:w-[340px] shrink-0 bg-paper border border-line rounded-xl flex flex-col min-h-[480px] max-h-[720px]"
            >
              <div className="px-3.5 py-3 border-b border-line space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="font-medium">
                    Tahap {stage.stepNumber}
                    {stages[idx + 1] && <span className="ml-1.5">→ {stages[idx + 1].title.split(' ')[0]}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{totalStagePcs} pcs</span>
                    <span className="min-w-5 h-5 px-1 rounded-full bg-surface border border-line-strong flex items-center justify-center font-medium text-ink tabular-nums">
                      {stageOrders.length}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-body shrink-0">
                    <StageIcon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-heading text-sm font-semibold text-ink leading-tight">{stage.title}</h3>
                    <p className="text-[11px] text-muted mt-0.5 truncate">{stage.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {stageOrders.length === 0 ? (
                  <div className="py-14 text-center border border-dashed border-line-strong rounded-lg flex flex-col items-center justify-center gap-1 px-4">
                    <StageIcon className="w-5 h-5 text-muted mb-1" aria-hidden="true" />
                    <p className="text-xs font-medium text-body">Tidak Ada Antrean</p>
                    <p className="text-[11px] text-muted">Tidak ada pesanan yang menunggu di tahap ini.</p>
                  </div>
                ) : (
                  stageOrders.map((order) => {
                    const step = getNextProductionStep(order.productionStatus);
                    return (
                      <article
                        key={order.orderId}
                        className="p-3 bg-surface border border-line hover:border-line-strong rounded-lg transition-colors space-y-2.5 cursor-pointer group"
                        onClick={() => navigate(`/admin/orders/${encodeURIComponent(order.orderId)}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/orders/${encodeURIComponent(order.orderId)}`);
                            }}
                            className="font-mono font-semibold text-xs text-ink group-hover:text-accent transition-colors cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {order.orderId}
                          </button>
                          <Badge tone={order.isCustomOrder ? 'accent' : 'neutral'}>{order.isCustomOrder ? 'Mockup Custom' : 'Katalog'}</Badge>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-ink flex items-center justify-between gap-2">
                            <span className="truncate">{order.customer}</span>
                            <span className="text-xs text-body shrink-0 tabular-nums">{order.quantity} pcs</span>
                          </p>
                          <p className="text-xs text-muted mt-0.5 truncate">{order.items?.[0]?.productName || order.productType || 'Pesanan Pakaian'}</p>
                        </div>

                        {(order.sizeSpec || order.material) && (
                          <div className="text-[11px] text-muted bg-paper px-2 py-1.5 rounded-md border border-line flex items-center justify-between">
                            <span className="truncate">{order.material || 'Katun Standar'}</span>
                            {order.sizeSpec && <span className="ml-2 shrink-0">({order.sizeSpec})</span>}
                          </div>
                        )}

                        <div className="pt-2.5 border-t border-line flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/orders/${encodeURIComponent(order.orderId)}`);
                            }}
                            className="text-xs font-medium text-body hover:text-ink flex items-center gap-1 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <span>Periksa</span>
                            <ChevronRight className="w-3 h-3" aria-hidden="true" />
                          </button>

                          {!step ? (
                            <span className="text-xs font-medium text-sage flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Siap Dikirim
                            </span>
                          ) : !canAdvance ? (
                            <span className="text-xs text-muted">{formatProductionStatusLabel(order.productionStatus)}</span>
                          ) : (
                            <AdminButton
                              size="sm"
                              variant="primary"
                              disabled={advancingId === order.orderId}
                              onClick={(e) => {
                                e.stopPropagation();
                                void advanceStage(order, step.next);
                              }}
                            >
                              <span>{step.label}</span>
                              <ArrowRight className="w-3 h-3" aria-hidden="true" />
                            </AdminButton>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="px-3 py-2 border-t border-line text-center">
                <span className="text-[11px] text-muted">
                  Tahap {stage.stepNumber} dari 06 • {stage.title}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
