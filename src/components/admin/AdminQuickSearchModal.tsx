import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, ShoppingBag, ArrowRight, ImageIcon } from 'lucide-react';
import { Order, Product } from '../../types';
import { fetchOrders, fetchProducts } from '../../utils/storage';
import { formatIDR, formatProductionStatusLabel } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { canAccessRoute } from '../../utils/permissions';

interface AdminQuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { label: 'Semua Pesanan', path: '/admin/orders' },
  { label: 'Papan Produksi', path: '/admin/production' },
  { label: 'Katalog & Stok', path: '/admin/products' },
  { label: 'Invoice', path: '/admin/invoices' },
];

export const AdminQuickSearchModal: React.FC<AdminQuickSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const { user, hasPermission } = useAuth();
  const canSeeProducts = hasPermission('products:read');

  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);

  // Load fresh data each time the search opens; ignore the response if the
  // modal was closed (or reopened) in the meantime.
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    Promise.all([fetchOrders(), canSeeProducts ? fetchProducts() : Promise.resolve({ data: [] as Product[], error: null })]).then(
      ([o, p]) => {
        if (cancelled) return;
        setOrders(o.data);
        setProducts(p.data);
        setLoadFailed(!!o.error);
        setIsLoading(false);
      }
    );
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      cancelled = true;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, canSeeProducts]);

  const trimmed = query.trim().toLowerCase();
  const trimmedDigits = trimmed.replace(/\D/g, '');

  const matchedOrders = useMemo(() => {
    if (!trimmed) return [];
    return orders
      .filter(
        (o) =>
          o.orderId.toLowerCase().includes(trimmed) ||
          o.customer.toLowerCase().includes(trimmed) ||
          o.phone.toLowerCase().includes(trimmed) ||
          (trimmedDigits.length >= 3 && o.phone.replace(/\D/g, '').includes(trimmedDigits)) ||
          (!!o.email && o.email.toLowerCase().includes(trimmed)) ||
          (!!o.productType && o.productType.toLowerCase().includes(trimmed)) ||
          o.items.some((it) => it.productName.toLowerCase().includes(trimmed))
      )
      .slice(0, 5);
  }, [orders, trimmed, trimmedDigits]);

  const matchedProducts = useMemo(() => {
    if (!trimmed || !canSeeProducts) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(trimmed) ||
          p.category.toLowerCase().includes(trimmed) ||
          p.slug.toLowerCase().includes(trimmed)
      )
      .slice(0, 4);
  }, [products, trimmed, canSeeProducts]);

  if (!isOpen) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  const openOrder = (orderId: string) => go(`/admin/orders/${encodeURIComponent(orderId)}`);

  const shortcuts = SHORTCUTS.filter((s) => canAccessRoute(user?.role, s.path));
  const rowClass =
    'w-full p-3 hover:bg-surface-hover transition-colors flex items-center justify-between gap-3 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';
  const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-muted mb-2 font-mono';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian cepat"
        className="w-full max-w-2xl bg-paper border border-line-strong rounded-xl shadow-2xl overflow-hidden animate-modal-content flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-line bg-surface flex items-center gap-3">
          <Search className="w-5 h-5 text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Cari pesanan atau produk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pesanan berdasarkan ID, nama customer, HP, atau produk..."
            className="flex-1 bg-transparent text-sm sm:text-base text-ink placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus pencarian"
              className="p-1 text-muted hover:text-ink rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs font-mono text-muted bg-surface-hover border border-line-strong rounded">
              Esc
            </kbd>
          )}
        </div>

        {/* Results / Suggestions Viewport */}
        <div className="p-4 overflow-y-auto space-y-5 text-sm">
          {isLoading && orders.length === 0 && <p className="text-xs text-muted py-2">Memuat data…</p>}
          {loadFailed && (
            <p role="alert" className="text-xs text-danger">
              Gagal memuat data pesanan. Hasil pencarian mungkin tidak lengkap.
            </p>
          )}

          {!trimmed ? (
            <div className="space-y-4">
              {shortcuts.length > 0 && (
                <div>
                  <p className={sectionTitle}>Navigasi Cepat</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {shortcuts.map((s) => (
                      <button
                        key={s.path}
                        type="button"
                        onClick={() => go(s.path)}
                        className="p-2.5 bg-surface border border-line hover:border-accent-soft rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-medium text-ink text-xs">{s.label}</span>
                        <ArrowRight className="w-3 h-3 text-muted" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {orders.length > 0 && (
                <div>
                  <p className={sectionTitle}>Pesanan Terbaru</p>
                  <div className="divide-y divide-line bg-surface border border-line rounded-lg overflow-hidden">
                    {orders.slice(0, 4).map((o) => (
                      <button key={o.orderId} type="button" onClick={() => openOrder(o.orderId)} className={rowClass}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-md bg-accent-wash text-accent flex items-center justify-center font-mono font-semibold text-xs shrink-0">
                            #
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{o.customer}</p>
                            <p className="text-xs text-muted font-mono truncate">
                              {o.orderId} • {o.items[0]?.productName || o.productType || 'Pesanan Custom'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-muted shrink-0">{formatProductionStatusLabel(o.productionStatus)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className={sectionTitle}>Pesanan ({matchedOrders.length})</p>
                {matchedOrders.length === 0 ? (
                  <p className="text-xs text-muted py-2">Tidak ada pesanan yang cocok.</p>
                ) : (
                  <div className="divide-y divide-line bg-surface border border-line rounded-lg overflow-hidden">
                    {matchedOrders.map((o) => (
                      <button key={o.orderId} type="button" onClick={() => openOrder(o.orderId)} className={rowClass}>
                        <div className="flex items-center gap-3 min-w-0">
                          <ShoppingBag className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">
                              {o.customer} <span className="font-mono text-xs text-muted ml-1">({o.orderId})</span>
                            </p>
                            <p className="text-xs text-muted truncate">
                              {o.phone} • {o.items[0]?.productName || o.productType}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-semibold text-ink block">{o.totalPrice ? formatIDR(o.totalPrice) : '-'}</span>
                          <span className="text-[11px] text-sage font-medium uppercase font-mono">
                            {formatProductionStatusLabel(o.productionStatus)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {matchedProducts.length > 0 && (
                <div>
                  <p className={sectionTitle}>Produk ({matchedProducts.length})</p>
                  <div className="divide-y divide-line bg-surface border border-line rounded-lg overflow-hidden">
                    {matchedProducts.map((p) => (
                      <button key={p.id} type="button" onClick={() => go('/admin/products')} className={rowClass}>
                        <div className="flex items-center gap-3 min-w-0">
                          {p.images[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              className="w-8 h-8 rounded object-cover border border-line"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded border border-line bg-paper flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted" aria-hidden="true" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{p.name}</p>
                            <span className="text-xs text-muted font-mono">{p.category}</span>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-ink shrink-0">{formatIDR(p.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-surface-hover border-t border-line flex items-center justify-between text-xs text-muted">
          <span>Tips: cari dengan nomor WhatsApp atau ID pesanan</span>
          <button type="button" onClick={onClose} className="hover:text-ink font-medium cursor-pointer">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
