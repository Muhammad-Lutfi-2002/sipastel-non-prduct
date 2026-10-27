import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, X } from 'lucide-react';
import { Product, CategoryType } from '../types';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from './Skeleton';

interface ProductGridProps {
  products: Product[];
  title?: string;
  subtitle?: string;
  isShopPage?: boolean;
  initialCategory?: CategoryType;
  isLoading?: boolean;
  onQuickView: (product: Product) => void;
  onAddToCartDirect: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onViewAllShop?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  title = 'BEST SELLER',
  subtitle = 'Signature cuts and popular silhouettes.',
  isShopPage = false,
  initialCategory = 'ALL',
  isLoading = false,
  onQuickView,
  onAddToCartDirect,
  onSelectProduct,
  onViewAllShop,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'bestseller' | 'price-low' | 'price-high'>('bestseller');
  type SortOption = typeof sortBy;

  const categoriesList: { key: CategoryType; label: string }[] = [
    { key: 'ALL', label: 'ALL PIECES' },
    { key: 'KAOS', label: 'KAOS / T-SHIRTS' },
    { key: 'JERSEY', label: 'AERO JERSEY' },
    { key: 'CUSTOM', label: 'CUSTOM APPAREL' },
    { key: 'BEST SELLER', label: 'BEST SELLER' },
    { key: 'NEW', label: 'NEW ARRIVALS' },
  ];

  // Filtering & Sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter((prod) => {
        if (selectedCategory === 'KAOS' && prod.category !== 'KAOS') return false;
        if (selectedCategory === 'JERSEY' && prod.category !== 'JERSEY') return false;
        if (selectedCategory === 'CUSTOM' && prod.category !== 'CUSTOM') return false;
        if (selectedCategory === 'BEST SELLER' && !prod.isBestSeller) return false;
        if (selectedCategory === 'NEW' && !prod.isNew) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = prod.name.toLowerCase().includes(q);
          const matchDesc = prod.shortDescription.toLowerCase().includes(q);
          const matchCat = prod.category.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        if (sortBy === 'bestseller') return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        return 0;
      });
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <section
      id="product-grid-section"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-16 md:py-20"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 pb-4 border-b border-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted font-semibold block mb-1">
            {isShopPage ? 'Catalog' : 'Curated Selection'}
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted mt-1.5 max-w-md">{subtitle}</p>
          )}
        </div>

        {!isShopPage && onViewAllShop && (
          <button
            onClick={onViewAllShop}
            className="text-xs font-bold uppercase tracking-wider text-ink hover:underline underline-offset-4 self-start sm:self-auto py-1 cursor-pointer"
          >
            Explore All Pieces →
          </button>
        )}
      </div>

      {/* Filter and Search Bar (Shop Page) */}
      {isShopPage && (
        <div className="mb-8 sm:mb-12 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Category tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categoriesList.map((cat) => (
                <button
                  key={cat.key}
                  id={`filter-tab-${cat.key.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`min-h-[40px] px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat.key
                      ? 'bg-accent text-on-accent'
                      : 'bg-surface-hover text-body hover:text-ink hover:bg-line'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <input
                  id="shop-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kaos, jersey, custom..."
                  className="w-full min-h-[42px] pl-9 pr-8 py-2 bg-paper border border-line-strong rounded-[2px] text-xs text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-3.5" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-muted hover:text-ink absolute right-2 top-2.5"
                    aria-label="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Select */}
              <div className="relative shrink-0">
                <select
                  id="shop-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none min-h-[42px] pl-3.5 pr-8 py-2 bg-paper border border-line-strong rounded-[2px] text-xs font-semibold text-ink focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="bestseller">Sort: Best Seller</option>
                  <option value="newest">Sort: Newest</option>
                  <option value="price-low">Harga: Rendah → Tinggi</option>
                  <option value="price-high">Harga: Tinggi → Rendah</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-muted absolute right-2.5 top-3.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Grid: 4 columns desktop, 3 tablet, 2 mobile */}
      {isLoading ? (
        <ProductGridSkeleton count={isShopPage ? 8 : 4} />
      ) : filteredProducts.length === 0 ? (
        <div id="no-products-state" className="py-16 sm:py-24 text-center bg-surface-hover rounded-[2px] border border-line my-6 animate-fade-in">
          <p className="font-heading text-xl font-bold text-ink">No products found.</p>
          <p className="text-xs sm:text-sm text-body mt-2 max-w-sm mx-auto">
            Tidak ada produk yang cocok dengan kata kunci "{searchQuery}" atau kategori yang dipilih.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
            className="mt-6 min-h-[42px] px-6 py-2.5 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-wider rounded-[2px] transition-all hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer"
          >
            Reset Filter & Cari Ulang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onQuickView={onQuickView}
              onAddToCartDirect={onAddToCartDirect}
              onSelectProduct={onSelectProduct}
            />
          ))}
        </div>
      )}
    </section>
  );
};
