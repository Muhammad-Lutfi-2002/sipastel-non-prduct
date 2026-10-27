import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { categoriesData } from '../data/categories';
import { BrandPlaceholder } from './BrandPlaceholder';
import { CategoryType } from '../types';

interface CategorySectionProps {
  onSelectCategory: (category: CategoryType) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ onSelectCategory }) => {
  return (
    <section
      id="category-navigation-section"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-16 md:py-20"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 pb-4 border-b border-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted font-semibold block mb-1">
            Collections & Categories
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            Selected Silhouettes.
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted max-w-sm leading-relaxed">
          Koleksi harian katun combed, jersey komunitas berpori sejuk, serta layanan custom order dengan pengerjaan terukur.
        </p>
      </div>

      {/* Image-Based Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {categoriesData.map((cat) => (
          <div
            key={cat.id}
            id={`category-card-${cat.id}`}
            onClick={() => onSelectCategory(cat.filterKey)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCategory(cat.filterKey);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Lihat kategori ${cat.name}`}
            className="group relative aspect-[3/4] overflow-hidden rounded-[2px] bg-surface-hover border border-line cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {/* Background: a real flat-lay or on-model photo per category
                (kaos / jersey / custom / best seller) fits best here. */}
            <BrandPlaceholder
              variant={cat.variant}
              className="transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Natural gradient vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141312]/90 via-[#141312]/30 to-transparent transition-opacity" />

            {/* Content overlay */}
            <div className="absolute inset-0 p-4 sm:p-5 md:p-6 flex flex-col justify-between text-ink-soft">
              <div className="flex justify-end">
                <span className="w-8 h-8 rounded-full bg-paper/20 backdrop-blur-xs flex items-center justify-center text-ink-soft group-hover:bg-paper group-hover:text-ink transition-all">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold tracking-[0.2em] text-[#D8D4CB] block mb-1">
                  SIPASTEL
                </span>
                <h3 className="font-heading text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-ink-soft uppercase">
                  {cat.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#E6E3DB] mt-1 line-clamp-1 opacity-90">
                  {cat.tagline}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
