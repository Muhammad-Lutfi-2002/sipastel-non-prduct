import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Menu, X, Instagram, Truck, Settings } from 'lucide-react';
import { getStoredStudioProfile } from '../utils/storage';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  cartCount: number;
  isCartPulsing?: boolean;
  onOpenCart: () => void;
  onNavigate: (view: 'home' | 'shop' | 'custom-order' | 'about' | 'how-to-order' | 'contact') => void;
  currentView: string;
  onOpenTrackOrder: () => void;
  onOpenAdmin: () => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  isCartPulsing = false,
  onOpenCart,
  onNavigate,
  currentView,
  onOpenTrackOrder,
  onOpenAdmin,
  onOpenSearch,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Logo is fully admin-managed (Settings > Logo Studio), never hardcoded.
  // null = no logo uploaded yet -> fall back to the SIPASTEL wordmark.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getStoredStudioProfile().then((profile) => setLogoUrl(profile.logoUrl));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { label: string; view: 'custom-order' | 'about' | 'how-to-order' | 'contact' }[] = [
    { label: 'CUSTOM STUDIO', view: 'custom-order' },
    { label: 'HOW TO ORDER', view: 'how-to-order' },
    { label: 'ABOUT', view: 'about' },
    { label: 'CONTACT', view: 'contact' },
  ];

  return (
    <>
      <header
        id="main-navbar"
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'py-3 bg-paper/95 backdrop-blur-md border-b border-line shadow-xs'
            : 'py-4 sm:py-5 bg-paper border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <button
            id="brand-logo-btn"
            onClick={() => {
              onOpenAdmin();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="SIPASTEL"
                className="h-9 sm:h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <span className="flex flex-col">
                <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-ink">
                  SIPASTEL
                </span>
                <span className="text-[11px] uppercase tracking-[0.25em] text-body font-semibold -mt-0.5">
                  SIPASTEL OFFICIAL
                </span>
              </span>
            )}
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-8">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.label}
                  id={`nav-link-${item.view}`}
                  onClick={() => onNavigate(item.view)}
                  className={`text-xs font-bold tracking-widest uppercase transition-colors relative py-1 cursor-pointer ${
                    isActive ? 'text-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-accent" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Search Trigger */}
            <button
              id="navbar-search-btn"
              onClick={onOpenSearch}
              className="p-2.5 text-muted hover:text-ink transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Cari produk"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Track Order */}
            <button
              id="navbar-track-order-btn"
              onClick={onOpenTrackOrder}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-wider uppercase text-body hover:text-ink transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="Lacak status pengerjaan pesanan"
            >
              <Truck className="w-3.5 h-3.5 text-accent" />
              <span>Track Order</span>
            </button>

            {/* Instagram Link */}
            <a
              id="navbar-instagram-link"
              href="https://www.instagram.com/sipastel_official/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 text-muted hover:text-ink transition-colors hidden sm:block"
              aria-label="Kunjungi Instagram SIPASTEL"
              title="Instagram @sipastel_official"
            >
              <Instagram className="w-4 h-4" />
            </a>

            {/* Admin Console Shortcut */}
            <button
              id="navbar-admin-btn"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 text-xs font-medium text-heading hover:text-ink bg-surface hover:bg-surface-hover px-2.5 py-1.5 rounded-[2px] border border-line-strong transition-all duration-150 cursor-pointer active:scale-98"
              title="Buka Console Owner & Admin SIPASTEL"
            >
              <Settings className="w-3.5 h-3.5 text-body" />
              <span className="font-semibold">Admin</span>
            </button>

            {/* Cart Bag Icon */}
            <button
              id="navbar-cart-btn"
              onClick={onOpenCart}
              className="relative p-2.5 text-ink hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Buka keranjang belanja"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span
                  id="navbar-cart-badge"
                  className={`absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-ink-soft text-[11px] font-bold flex items-center justify-center leading-none transition-transform ${
                    isCartPulsing ? 'animate-cart-pulse' : ''
                  }`}
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger Menu */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-ink hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-backdrop"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            id="mobile-nav-drawer"
            className="w-4/5 max-w-sm bg-paper text-ink h-full shadow-2xl p-6 flex flex-col justify-between border-r border-line animate-slide-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-line">
                <div>
                  {logoUrl ? (
                    <img src={logoUrl} alt="SIPASTEL" className="h-8 w-auto max-w-[140px] object-contain" />
                  ) : (
                    <>
                      <span className="font-heading font-extrabold text-xl tracking-tight text-ink block">
                        SIPASTEL
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-body">
                        APPAREL STUDIO
                      </span>
                    </>
                  )}
                </div>
                <button
                  id="close-mobile-menu-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-muted cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Tutup menu navigasi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Navigation Links (touch targets >= 44px) */}
              <nav className="flex flex-col py-4 divide-y divide-line">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigate(item.view);
                    }}
                    className={`min-h-[46px] flex items-center text-left text-sm font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                      currentView === item.view ? 'text-accent' : 'text-body'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenTrackOrder();
                  }}
                  className="min-h-[46px] flex items-center gap-2 text-left text-sm font-semibold tracking-wider text-body cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Truck className="w-4 h-4 text-accent" />
                  <span>Track Order</span>
                </button>

                <button
                  id="mobile-admin-btn"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="min-h-[46px] flex items-center gap-2.5 text-left text-xs font-bold uppercase tracking-wider text-ink bg-surface px-3 py-2.5 my-1.5 rounded-[2px] border border-line-strong hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Settings className="w-4 h-4 text-body" />
                  <span>Admin Dashboard & Pipeline</span>
                </button>
              </nav>
            </div>

            {/* Mobile Footer Drawer */}
            <div className="pt-6 border-t border-line space-y-4 text-xs text-body">
              <ThemeToggle variant="switch" />
              <a
                href="https://www.instagram.com/sipastel_official/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-ink font-semibold min-h-[40px]"
              >
                <Instagram className="w-4 h-4 text-accent" />
                <span>@sipastel_official</span>
              </a>
              <p className="text-[11px] text-muted leading-relaxed">
                Bogor, Jawa Barat. Custom apparel made to feel personal.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
