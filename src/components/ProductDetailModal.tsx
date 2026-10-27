import React, { useState, useEffect } from 'react';
import { X, Ruler, ShoppingBag, MessageCircle, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { createWhatsAppUrl } from '../utils/whatsapp';
import { LazyImage } from './LazyImage';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, size: string, color: string, quantity: number) => void;
  onCustomOrderClick?: () => void;
  onOpenSizeGuide?: (category: 'KAOS' | 'JERSEY') => void;
  onWhatsAppInquiry?: (message: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onOpenSizeGuide,
  onWhatsAppInquiry,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(product?.sizes[0] || 'M');
  const [selectedColor, setSelectedColor] = useState<string>(product?.colors[0]?.name || '');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [isOpeningWA, setIsOpeningWA] = useState(false);

  // Sync state when product changes
  useEffect(() => {
    if (product) {
      setSelectedImageIdx(0);
      setSelectedSize(product.sizes[0] || 'M');
      setSelectedColor(product.colors[0]?.name || '');
      setQuantity(1);
      setIsAdding(false);
      setIsAdded(false);
      setIsOpeningWA(false);
    }
  }, [product]);

  // Escape + scroll lock only while a product is actually open.
  useEscapeKey(!!product, onClose);
  useBodyScrollLock(!!product);

  if (!product) return null;

  const handleAddToCartClick = () => {
    if (isAdding) return;
    setIsAdding(true);

    setTimeout(() => {
      onAddToCart(product, selectedSize, selectedColor, quantity);
      setIsAdding(false);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 2000);
    }, 300);
  };

  const handleDirectWhatsApp = () => {
    if (isOpeningWA) return;
    setIsOpeningWA(true);

    const waMsg = `Hi SIPASTEL! Saya ingin memesan langsung:
• ${product.name}
• Warna: ${selectedColor}
• Ukuran: ${selectedSize}
• Kuantitas: ${quantity} pcs
• Total: ${product.formattedPrice}

Mohon informasi ketersediaan stok dan rekening pembayaran. Terima kasih!`;

    if (onWhatsAppInquiry) {
      onWhatsAppInquiry(waMsg);
    }

    setTimeout(() => {
      window.open(createWhatsAppUrl(waMsg), '_blank');
      setIsOpeningWA(false);
    }, 450);
  };

  const nextImage = () => {
    setSelectedImageIdx((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    setSelectedImageIdx((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  return (
    <div
      id="product-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        id="product-detail-modal-content"
        className="bg-paper text-ink w-full max-w-4xl rounded-[2px] shadow-2xl border-0 sm:border border-line relative my-auto max-h-[100vh] sm:max-h-[92vh] overflow-y-auto flex flex-col animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Close Button */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 bg-paper/95 backdrop-blur-md border-b border-line">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
            {product.category} • SIPASTEL STUDIO BOGOR
          </span>
          <button
            id="close-product-modal-btn"
            onClick={onClose}
            className="p-2 text-body hover:text-ink rounded-[2px] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Tutup detail produk (Esc)"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content: 2-Column Desktop Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 p-5 sm:p-8 flex-1">
          {/* Gallery Column */}
          <div className="md:col-span-6 space-y-3">
            {/* Main Active Image Frame */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-hover rounded-[2px] border border-line group">
              <LazyImage
                src={product.images[selectedImageIdx] || product.images[0]}
                alt={`${product.name} visual preview`}
                aspectRatio="aspect-[3/4]"
              />

              {product.isBestSeller && (
                <span className="absolute top-3 left-3 px-2.5 py-1 text-[11px] uppercase font-bold tracking-widest bg-accent text-on-accent z-10">
                  Best Seller
                </span>
              )}

              {/* Next / Prev Chevrons */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-paper/80 hover:bg-paper text-ink flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Gambar sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-paper/80 hover:bg-paper text-ink flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Gambar berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {(product.images || []).length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(product.images || []).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative w-16 h-20 shrink-0 overflow-hidden rounded-[2px] border transition-all cursor-pointer ${
                      selectedImageIdx === idx
                        ? 'border-accent ring-1 ring-accent'
                        : 'border-line-strong opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info & Action Column */}
          <div className="md:col-span-6 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Title & Price */}
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-tight">
                  {product.name}
                </h1>
                <p className="font-heading text-xl sm:text-2xl font-bold text-ink mt-2">
                  {product.formattedPrice}
                </p>
                <p className="text-xs sm:text-sm text-body mt-3 leading-relaxed">
                  {product.shortDescription}
                </p>
              </div>

              {/* Color Selection */}
              {(product.colors || []).length > 0 && (
                <div className="space-y-2 border-t border-line pt-4">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-heading">
                    <span>Color: <strong className="text-ink font-bold">{selectedColor}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(product.colors || []).map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-[2px] border text-xs font-medium transition-all cursor-pointer ${
                          selectedColor === c.name
                            ? 'border-accent bg-paper shadow-xs ring-1 ring-accent'
                            : 'border-line-strong bg-paper hover:border-[#999]'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-xs">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              <div className="space-y-2 border-t border-line pt-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-heading">
                  <span>Size: <strong className="text-ink font-bold">{selectedSize}</strong></span>
                  {onOpenSizeGuide && (
                    <button
                      onClick={() => onOpenSizeGuide(product.category === 'JERSEY' ? 'JERSEY' : 'KAOS')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-body hover:text-ink underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      <span>Size Guide</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(product.sizes || []).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`min-w-[48px] min-h-[42px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-[2px] border transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer ${
                        selectedSize === s
                          ? 'bg-accent text-on-accent border-accent'
                          : 'bg-paper text-ink border-line-strong hover:border-accent'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="space-y-2 border-t border-line pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-heading block">
                  Quantity
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-line-strong rounded-[2px] bg-paper">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-10 min-h-[42px] flex items-center justify-center text-sm font-bold text-ink hover:bg-surface-hover transition-colors disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label="Kurangi jumlah"
                    >
                      –
                    </button>
                    <span className="w-12 text-center text-sm font-bold font-mono text-ink">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-10 min-h-[42px] flex items-center justify-center text-sm font-bold text-ink hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label="Tambah jumlah"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted">
                    Ready stock • Siap kirim 1–2 hari kerja
                  </span>
                </div>
              </div>

              {/* Primary Actions with Interactive States */}
              <div className="space-y-2.5 pt-2">
                <button
                  id="modal-add-to-cart-btn"
                  onClick={handleAddToCartClick}
                  disabled={isAdding}
                  className={`w-full min-h-[48px] px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                    isAdded
                      ? 'bg-sage text-ink-soft'
                      : 'bg-accent hover:bg-accent-soft text-on-accent hover:-translate-y-[1px]'
                  }`}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding to Bag...</span>
                    </>
                  ) : isAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>✓ Ditambahkan ke Keranjang</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Bag</span>
                    </>
                  )}
                </button>

                <button
                  id="modal-whatsapp-order-btn"
                  onClick={handleDirectWhatsApp}
                  disabled={isOpeningWA}
                  className="w-full min-h-[46px] px-6 py-3 bg-transparent hover:bg-paper text-ink border border-accent text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {isOpeningWA ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sage-soft" />
                      <span>Opening WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4 text-sage-soft" />
                      <span>Order Directly via WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              {/* Fabric Specs Summary */}
              <div className="pt-3 border-t border-line text-xs text-muted space-y-1">
                <p><strong>Material:</strong> {product.material}</p>
                <p><strong>Siluet:</strong> {product.fit}</p>
                <p><strong>Produksi:</strong> {product.productionTime}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
