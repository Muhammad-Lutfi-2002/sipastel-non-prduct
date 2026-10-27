import React, { useEffect } from 'react';
import { X, Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { CartItem } from '../types';
import { formatIDR } from '../utils/formatters';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  onExploreCollection: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onExploreCollection,
}) => {
  // Escape + scroll lock only while the drawer is open.
  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div
      id="cart-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        id="cart-drawer-content"
        className="w-full max-w-md bg-paper text-ink h-full shadow-2xl flex flex-col justify-between border-l border-line animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-ink" />
            <h2 className="font-heading text-lg font-bold tracking-tight">Shopping Bag</h2>
            <span className="text-xs text-muted font-semibold">({cart.length})</span>
          </div>
          <button
            id="close-cart-btn"
            onClick={onClose}
            className="p-1.5 text-body hover:text-ink transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Tutup keranjang (Esc)"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Items or Empty State */}
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div id="empty-cart-state" className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center text-muted">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="font-heading text-lg font-bold text-ink">
                Your bag is empty.
              </p>
              <p className="text-xs text-body max-w-xs leading-relaxed">
                Belum ada produk yang Anda tambahkan. Jelajahi katalog katun combed dan aero jersey kami.
              </p>
              <button
                id="empty-cart-explore-btn"
                onClick={() => {
                  onClose();
                  onExploreCollection();
                }}
                className="mt-2 min-h-[44px] px-6 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <div className="space-y-4 divide-y divide-line">
              {cart.map((item) => (
                <div key={item.id} className="pt-4 first:pt-0 flex gap-3.5 items-start animate-fade-in">
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-20 h-24 object-cover rounded-[2px] border border-line bg-surface-hover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-xs font-bold text-ink line-clamp-1">
                        {item.productName}
                      </h4>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-muted hover:text-danger transition-colors p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`Hapus ${item.productName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-body mt-0.5">
                      {item.color} / Size {item.size}
                    </p>

                    <div className="flex items-center justify-between mt-3.5">
                      <div className="flex items-center border border-line-strong bg-paper rounded-[2px]">
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center text-xs font-bold text-ink hover:bg-surface-hover transition-colors disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label="Kurangi"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-bold text-ink">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="w-8 h-8 flex items-center justify-center text-xs font-bold text-ink hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label="Tambah"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-bold text-ink">
                        {formatIDR(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Subtotal & Actions */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-line bg-surface-hover space-y-3">
            <div className="flex items-center justify-between text-xs text-body">
              <span>Subtotal</span>
              <span className="text-base font-bold text-ink">
                {formatIDR(subtotal)}
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Ongkos kirim dihitung pada konfirmasi pesanan (JNE / SiCepat / J&T dari Bogor).
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                id="cart-checkout-btn"
                onClick={() => {
                  onClose();
                  onCheckout();
                }}
                className="w-full min-h-[48px] px-4 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span>Checkout Pesanan</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="cart-continue-shopping-btn"
                onClick={onClose}
                className="w-full py-2.5 px-4 text-body hover:text-ink text-xs font-semibold uppercase tracking-wider transition-colors text-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
