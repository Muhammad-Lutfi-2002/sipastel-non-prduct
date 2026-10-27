import React, { useState, useMemo, useEffect } from 'react';
import { Users, Search, MessageCircle, X } from 'lucide-react';
import { AdminTableSkeleton } from '../../Skeleton';
import { formatDate, formatIDR } from '../../../utils/formatters';
import { createWhatsAppUrl } from '../../../utils/whatsapp';
import { normalizeIdPhone } from '../../../utils/phone';
import { useOrders } from '../../../hooks/useOrders';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { Pagination } from '../Pagination';
import { Badge, Card, EmptyState, PageHeader, buttonClass, cn, inputClass } from '../ui';

const PAGE_SIZE = 25;

interface Customer {
  key: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  ordersCount: number;
  totalPaid: number;
  lastOrderDate: string;
}

export const CustomersView: React.FC = () => {
  const { orders, isLoading, isRefreshing, error, refresh } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // The directory is derived from orders. Customers are identified by their
  // NORMALISED phone number, so "0812-3456-7890", "+62 812 3456 7890" and
  // "6281234567890" are one person, not three. Contact details shown are
  // taken from the customer's most recent order.
  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    for (const ord of orders) {
      const key = normalizeIdPhone(ord.phone) || `name:${ord.customer.trim().toLowerCase()}`;
      const paid = ord.totalPaid || 0; // money actually received (incl. partial DP)
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          key,
          name: ord.customer,
          phone: ord.phone,
          email: ord.email,
          city: ord.city,
          ordersCount: 1,
          totalPaid: paid,
          lastOrderDate: ord.createdAt,
        });
        continue;
      }

      existing.ordersCount += 1;
      existing.totalPaid += paid;
      if (new Date(ord.createdAt) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = ord.createdAt;
        existing.name = ord.customer;
        existing.phone = ord.phone;
        existing.email = ord.email || existing.email;
        existing.city = ord.city;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
    );
  }, [orders]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    const qDigits = q.replace(/\D/g, '');
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits)) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <PageHeader title="Direktori Pelanggan" />
        <AdminTableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Direktori Pelanggan"
        description="Data hubungan pelanggan, volume pesanan, dan komunikasi langsung via WhatsApp."
        actions={<Badge tone="neutral">{customers.length} pelanggan</Badge>}
      />

      {error && <LoadErrorBanner message={error} onRetry={() => void refresh()} isRetrying={isRefreshing} hasStaleData={orders.length > 0} />}

      <div className="relative w-full sm:max-w-sm">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          aria-label="Cari pelanggan"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan, WhatsApp, kota..."
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

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-hover/50 text-muted text-xs">
                <th scope="col" className="py-2.5 px-4 font-medium">Nama Pelanggan</th>
                <th scope="col" className="py-2.5 px-4 font-medium">WhatsApp</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Email</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Kota</th>
                <th scope="col" className="py-2.5 px-4 font-medium text-center">Pesanan</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Total Dibayar</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Pesanan Terakhir</th>
                <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={Users}
                      title={customers.length === 0 && !error ? 'Belum ada pelanggan.' : 'Tidak ada pelanggan ditemukan.'}
                      description={
                        customers.length === 0 && !error
                          ? 'Pelanggan muncul otomatis setelah ada pesanan masuk.'
                          : 'Tidak ada pelanggan yang cocok dengan kriteria pencarian.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((cust) => (
                  <tr key={cust.key} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-ink">{cust.name}</p>
                    </td>
                    <td className="py-3.5 px-4 text-body">{cust.phone}</td>
                    <td className="py-3.5 px-4 text-muted">{cust.email || '—'}</td>
                    <td className="py-3.5 px-4 text-body">{cust.city}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-ink tabular-nums">{cust.ordersCount}</td>
                    <td className="py-3.5 px-4 font-medium text-ink tabular-nums">{formatIDR(cust.totalPaid)}</td>
                    <td className="py-3.5 px-4 text-muted">{formatDate(cust.lastOrderDate)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={createWhatsAppUrl(
                          `Halo ${cust.name}, salam dari SIPASTEL Studio. Ada yang bisa kami bantu seputar pesanan apparel Anda?`,
                          cust.phone
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Chat WhatsApp ${cust.name}`}
                        className={buttonClass('secondary', 'sm', 'text-sage border-sage/30 hover:bg-sage/10')}
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Chat</span>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-line">
          <p className="text-xs text-muted mb-2">
            Menampilkan <strong className="text-ink">{filtered.length}</strong> dari <strong className="text-ink">{customers.length}</strong> pelanggan
          </p>
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
};
