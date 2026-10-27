import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { formatIDR } from '../utils/formatters';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
    setQuery('');
  }, [isOpen]);

  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q)
    );
  }, [query, products]);

  if (!isOpen) return null;

  return (
    <div
      id="search-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        id="search-modal-content"
        className="bg-paper text-ink w-full max-w-2xl rounded-[2px] shadow-2xl border border-line overflow-hidden animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 p-4 border-b border-line">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kaos, jersey, custom apparel..."
            className="w-full bg-transparent text-sm sm:text-base text-ink placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="p-1 text-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink text-xs font-semibold uppercase tracking-wider"
          >
            Esc
          </button>
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!query.trim() ? (
            <div className="py-6 text-center text-xs text-muted">
              <p className="font-semibold text-ink mb-2">Pencarian Populer:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Boxy Tee', 'Jersey Milano', 'Custom Komunitas', 'Sage Green', 'Heavyweight'].map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-2.5 py-1 bg-surface-hover hover:bg-line text-heading rounded-xs transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              <p className="font-bold text-sm text-ink">Tidak ditemukan hasil</p>
              <p className="mt-1">Coba kata kunci lain atau buka halaman katalog lengkap.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                Ditemukan {results.length} produk
              </p>
              {results.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    onClose();
                    onSelectProduct(product);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClose();
                      onSelectProduct(product);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Lihat detail ${product.name}`}
                  className="flex items-center justify-between p-2.5 hover:bg-surface-hover rounded-xs transition-colors cursor-pointer border border-transparent hover:border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-12 h-14 object-cover rounded-xs border border-line bg-surface-hover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-ink">{product.name}</h4>
                      <p className="text-[11px] text-muted">{product.category} • {product.formattedPrice}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
