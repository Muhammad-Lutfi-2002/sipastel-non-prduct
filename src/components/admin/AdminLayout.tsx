import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Scissors,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Inbox,
  Palette,
  CheckCircle2,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { AdminNotificationCenter } from './AdminNotificationCenter';
import { AdminQuickSearchModal } from './AdminQuickSearchModal';
import { AdminToastProvider } from './AdminToast';
import { ThemeToggle } from '../ThemeToggle';
import { formatRoleLabel } from '../../utils/formatters';
import { getStoredStudioProfile } from '../../utils/storage';
import { canAccessRoute } from '../../utils/permissions';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Breadcrumb, Dialog, AdminButton, cn, type Crumb } from './ui';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const ALL_NAVIGATION_GROUPS: NavGroup[] = [
  {
    heading: 'Ringkasan',
    items: [{ label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    heading: 'Pesanan',
    items: [
      { label: 'Semua Pesanan', path: '/admin/orders', icon: ShoppingBag },
      { label: 'Pesanan Baru', path: '/admin/orders?status=new', icon: Inbox },
      { label: 'Produksi', path: '/admin/production', icon: Scissors },
    ],
  },
  {
    heading: 'Bisnis',
    items: [
      { label: 'Katalog & Stok', path: '/admin/products', icon: Package },
      { label: 'Pelanggan', path: '/admin/customers', icon: Users },
      { label: 'Invoice', path: '/admin/invoices', icon: FileText },
    ],
  },
  {
    heading: 'Pintasan Kerja',
    items: [
      { label: 'Desain', path: '/admin/production?stage=design', icon: Palette },
      { label: 'QC', path: '/admin/production?stage=qc', icon: CheckCircle2 },
      { label: 'Siap Kirim', path: '/admin/orders?status=ready_to_ship', icon: Truck },
    ],
  },
  {
    heading: 'Sistem',
    items: [{ label: 'Pengaturan', path: '/admin/settings', icon: Settings }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/dashboard': 'Dashboard',
  '/admin/orders': 'Pesanan',
  '/admin/production': 'Produksi',
  '/admin/products': 'Katalog & Stok',
  '/admin/customers': 'Pelanggan',
  '/admin/invoices': 'Invoice',
  '/admin/settings': 'Pengaturan',
};

function buildBreadcrumb(pathname: string): Crumb[] {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const root: Crumb = { label: 'Studio', path: '/admin/dashboard' };
  const detail = clean.match(/^\/admin\/orders\/([^/]+)$/);
  if (detail) {
    let id = detail[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      /* keep raw */
    }
    return [root, { label: 'Pesanan', path: '/admin/orders' }, { label: id }];
  }
  return [root, { label: PAGE_TITLES[clean] ?? 'Dashboard' }];
}

const NavList: React.FC<{
  groups: NavGroup[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}> = ({ groups, isActive, onNavigate }) => (
  <nav aria-label="Navigasi utama" className="space-y-5">
    {groups.map((group) => (
      <div key={group.heading} className="space-y-0.5">
        <span className="block px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{group.heading}</span>
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition-colors cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active ? 'bg-surface-hover text-ink font-medium' : 'text-body hover:bg-surface-hover/70 hover:text-ink'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-accent' : 'text-muted')} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    ))}
  </nav>
);

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname, search, navigate } = useRouter();
  const isOnline = useOnlineStatus();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  // Same admin-managed logo as the customer Navbar - null falls back to wordmark.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStoredStudioProfile().then((profile) => {
      if (!cancelled) setLogoUrl(profile.logoUrl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEscapeKey(isMobileMenuOpen, () => setIsMobileMenuOpen(false));
  useBodyScrollLock(isMobileMenuOpen);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to open Quick Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, search]);

  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // An item is active when its path matches and, if it carries a query
  // (e.g. ?status=new), that exact query is present. Plain list pages are
  // only active when no filter query is set, so "Semua Pesanan" and
  // "Pesanan Baru" never light up together.
  const isCurrentActive = (itemPath: string) => {
    const [targetPath, targetQuery = ''] = itemPath.split('?');
    if (targetQuery) return pathname === targetPath && search === `?${targetQuery}`;
    if (targetPath === '/admin/orders' || targetPath === '/admin/production') {
      return pathname === targetPath && search === '';
    }
    return pathname === targetPath;
  };

  // Items a role may not open are not shown.
  const navigationGroups = ALL_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessRoute(user?.role, item.path)),
  })).filter((group) => group.items.length > 0);

  const initial = (user?.name?.charAt(0) || 'A').toUpperCase();

  const brand = (compact = false) => (
    <button
      type="button"
      onClick={() => handleNavigate('/admin/dashboard')}
      aria-label="Ke halaman dashboard"
      className="flex items-center gap-2 text-left rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {logoUrl ? (
        <img src={logoUrl} alt="SIPASTEL" className={cn('w-auto object-contain', compact ? 'h-7 max-w-[120px]' : 'h-8 max-w-[150px]')} />
      ) : (
        <>
          <span className="w-7 h-7 rounded-lg bg-accent text-on-accent font-heading font-bold text-sm flex items-center justify-center" aria-hidden="true">
            S
          </span>
          <span className="font-heading font-semibold text-[15px] tracking-tight text-ink">SIPASTEL</span>
        </>
      )}
    </button>
  );

  return (
    <AdminToastProvider>
      <div className="min-h-screen bg-paper text-ink flex font-sans">
        <AdminQuickSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />

        {/* Desktop sidebar (first in DOM so it is the first navigation landmark) */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-paper border-r border-line sticky top-0 h-screen select-none">
          <div className="px-4 h-14 flex items-center border-b border-line shrink-0">{brand()}</div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavList groups={navigationGroups} isActive={isCurrentActive} onNavigate={handleNavigate} />
          </div>

          <div className="shrink-0 p-3 border-t border-line space-y-2">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="w-8 h-8 rounded-full bg-accent-wash text-accent font-heading font-semibold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink truncate leading-tight">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-muted truncate leading-tight mt-0.5">{formatRoleLabel(user?.role)}</p>
              </div>
              <span
                className={cn('flex items-center gap-1 text-[11px] font-medium shrink-0', isOnline ? 'text-sage' : 'text-danger')}
                title={user?.email}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-sage' : 'bg-danger')} aria-hidden="true" />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="w-full h-9 px-2.5 text-[13px] text-body hover:text-danger hover:bg-danger/10 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 h-14 bg-paper/90 backdrop-blur-md border-b border-line px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="lg:hidden p-2 -ml-2 text-body hover:text-ink hover:bg-surface-hover rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Buka/tutup menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
              </button>
              <div className="hidden sm:block min-w-0">
                <Breadcrumb items={buildBreadcrumb(pathname)} onNavigate={handleNavigate} />
              </div>
              <span className="sm:hidden font-heading font-semibold text-sm text-ink truncate">
                {buildBreadcrumb(pathname).slice(-1)[0].label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                className="flex items-center gap-2 h-8 px-2.5 text-xs text-muted hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Cari pesanan, produk...</span>
                <span className="sm:hidden">Cari</span>
                <kbd className="hidden md:inline-flex px-1.5 text-[11px] font-mono text-muted bg-surface-hover border border-line-strong rounded">
                  {shortcutLabel}
                </kbd>
              </button>
              <AdminNotificationCenter />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
        </div>

        {/* Mobile drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50 flex animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              className="w-72 max-w-[85vw] bg-paper h-full flex flex-col border-r border-line shadow-2xl animate-slide-right"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-line shrink-0">
                {brand(true)}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="p-2 -mr-2 text-muted hover:text-ink rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavList groups={navigationGroups} isActive={isCurrentActive} onNavigate={handleNavigate} />
              </div>
              <div className="shrink-0 p-3 border-t border-line space-y-2">
                <div className="flex items-center gap-2.5 px-2">
                  <span className="w-8 h-8 rounded-full bg-accent-wash text-accent font-heading font-semibold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">{user?.name || 'Admin'}</p>
                    <p className="text-[11px] text-muted truncate">{formatRoleLabel(user?.role)}</p>
                  </div>
                  <span className={cn('flex items-center gap-1 text-[11px] font-medium', isOnline ? 'text-sage' : 'text-danger')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-sage' : 'bg-danger')} aria-hidden="true" />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <ThemeToggle variant="switch" className="px-2 py-1" />
                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="w-full h-10 px-3 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
          </div>
        )}

        <Dialog
          open={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          title="Konfirmasi Keluar"
          description="Anda yakin ingin keluar dari Studio Console SIPASTEL? Anda perlu login kembali untuk mengakses data pesanan dan produksi."
          footer={
            <>
              <AdminButton variant="secondary" onClick={() => setIsLogoutModalOpen(false)}>
                Batal
              </AdminButton>
              <AdminButton variant="danger" onClick={handleConfirmLogout}>
                Keluar
              </AdminButton>
            </>
          }
        />
      </div>
    </AdminToastProvider>
  );
};
