import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  ShoppingBag,
  CreditCard,
  Palette,
  Scissors,
  CheckCircle2,
  Truck,
  ChevronRight,
  X,
} from 'lucide-react';
import { AdminNotification } from '../../types';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService';
import { useRouter } from '../../context/RouterContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const POLL_MS = 30_000;

export const AdminNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const refresh = async () => {
    const res = await fetchNotifications();
    // Keep what is already shown if a background refresh fails.
    if (!res.error) setNotifications(res.data);
  };

  useEffect(() => {
    void refresh();
    // New notifications are created server-side by triggers when other staff
    // act on an order; poll for them, but only while the tab is visible.
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEscapeKey(isOpen, () => setIsOpen(false));

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const result = await markAllNotificationsAsRead();
    if (!result.success) await refresh(); // put the real state back
  };

  const handleClickItem = async (notif: AdminNotification) => {
    setIsOpen(false);
    if (notif.orderId) {
      navigate(`/admin/orders/${encodeURIComponent(notif.orderId)}`);
    }
    if (!notif.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      const result = await markNotificationAsRead(notif.id);
      if (!result.success) await refresh();
    }
  };

  const getCategoryConfig = (category: AdminNotification['category']) => {
    switch (category) {
      case 'ORDER':
        return {
          icon: <ShoppingBag className="w-3.5 h-3.5 text-accent" />,
          bg: 'bg-accent-wash',
          label: 'Pesanan Baru',
        };
      case 'PAYMENT':
        return {
          icon: <CreditCard className="w-3.5 h-3.5 text-sage" />,
          bg: 'bg-sage/10',
          label: 'Pembayaran',
        };
      case 'DESIGN':
        return {
          icon: <Palette className="w-3.5 h-3.5 text-info" />,
          bg: 'bg-info/10',
          label: 'Desain',
        };
      case 'PRODUCTION':
        return {
          icon: <Scissors className="w-3.5 h-3.5 text-warning" />,
          bg: 'bg-warning/10',
          label: 'Produksi',
        };
      case 'QC':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-info" />,
          bg: 'bg-info/10',
          label: 'Quality Control',
        };
      case 'SHIPPING':
        return {
          icon: <Truck className="w-3.5 h-3.5 text-sage" />,
          bg: 'bg-sage/10',
          label: 'Pengiriman',
        };
      default:
        return {
          icon: <Bell className="w-3.5 h-3.5 text-body" />,
          bg: 'bg-surface-hover',
          label: 'Sistem',
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      return `${Math.floor(diffHours / 24)} hari lalu`;
    } catch {
      return '';
    }
  };

  const displayedList = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with tiny, non-intrusive indicator */}
      <button
        id="admin-notification-bell-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative p-2 text-body hover:text-ink hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
        title="Pusat Notifikasi Operasional"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-accent ring-2 ring-paper text-[11px] font-bold text-on-accent flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
      <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-surface border border-line shadow-[0_12px_40px_rgba(0,0,0,0.35)] rounded-xl z-50 overflow-hidden animate-modal-content">
          {/* Header */}
          <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-xs text-ink tracking-tight">
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent-wash text-accent text-[11px] font-semibold">
                  {unreadCount} baru
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Tandai semua dibaca</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup notifikasi"
                className="p-1 text-muted hover:text-ink rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tab */}
          <div className="flex border-b border-line bg-surface text-xs px-2 pt-1">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`flex-1 py-1.5 text-center font-medium text-[11px] transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'border-b-2 border-ink text-ink font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`flex-1 py-1.5 text-center font-medium text-[11px] transition-colors cursor-pointer ${
                filter === 'UNREAD'
                  ? 'border-b-2 border-ink text-ink font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* List */}
         <div className="max-h-[60vh] sm:max-h-84 overflow-y-auto divide-y divide-line">
            {displayedList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                Tidak ada notifikasi{filter === 'UNREAD' ? ' yang belum dibaca' : ''}.
              </div>
            ) : (
              displayedList.map((notif) => {
                const conf = getCategoryConfig(notif.category);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleClickItem(notif)}
                    className={`w-full p-3.5 text-left transition-colors cursor-pointer flex items-start gap-3 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                      !notif.isRead ? 'bg-surface-hover/60' : ''
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg ${conf.bg} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      {conf.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-ink truncate">
                          {conf.label}
                        </span>
                        <span className="text-[11px] text-muted shrink-0 font-mono">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-body mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted mt-1.5">
                        {notif.orderId && (
                          <span className="font-mono text-accent font-medium">
                            {notif.orderId}
                          </span>
                        )}
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-soft ml-auto shrink-0" />
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0 mt-1" aria-hidden="true" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
