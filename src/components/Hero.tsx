import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandPlaceholder } from './BrandPlaceholder';

interface HeroProps {
  onShopClick: () => void;
  onCustomClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onShopClick, onCustomClick }) => {
  return (
    <section
      id="hero-section"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-2 pb-14 sm:pb-20 md:pb-24"
    >
      {/* Editorial Hero Container */}
      <div className="relative w-full overflow-hidden rounded-[2px] bg-paper">
        {/* Cinematic Background Image Container */}
        <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[560px]">
          {/* Photo slot: a strong lifestyle/campaign shot of someone wearing
              SIPASTEL apparel works best here. */}
          <BrandPlaceholder variant="accent" className="brightness-[0.85]" iconClassName="w-16 h-16 sm:w-20 sm:h-20" />

          {/* Natural photographic gradient overlay - deeper for the dark theme */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0807] via-[#0A0807]/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0807]/70 via-transparent to-transparent hidden md:block" />

          {/* Top Studio Stamp */}
          <div className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-3">
            <span className="text-[11px] uppercase font-bold tracking-[0.25em] text-ink/85 px-2.5 py-1 border border-ink/25 backdrop-blur-xs">
              BOGOR • INDONESIA
            </span>
            <span className="text-[11px] uppercase font-semibold tracking-[0.2em] text-heading hidden sm:inline">
              AUTUMN / DAILY SERIES
            </span>
          </div>

          {/* Editorial Content Layout */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 md:p-14 lg:p-16 text-ink">
            <div className="max-w-2xl">
              {/* Official slogan - used once, as the brand's confident opening line */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-[2px] bg-accent" />
                <span className="text-sm sm:text-base uppercase tracking-[0.25em] text-accent font-bold">
                  YOU PLAN, WE EXECUTE
                </span>
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-ink leading-[1.04] mb-4">
                WEAR YOUR IDEA.
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-heading font-normal leading-relaxed max-w-lg mb-8">
                Pakaian yang dirancang untuk terasa personal. Dari potongan katun heavyweight 16s bertekstur tenang hingga technical aero jersey untuk komunitas Anda.
              </p>

              {/* CTAs - orange used with intent on the primary action only */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  id="hero-shop-collection-cta"
                  onClick={onShopClick}
                  className="min-h-[48px] px-8 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.99] rounded-[2px] flex items-center justify-center gap-2 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>SHOP COLLECTION</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  id="hero-custom-order-cta"
                  onClick={onCustomClick}
                  className="min-h-[48px] px-8 bg-transparent hover:bg-ink/10 text-ink border border-ink/40 hover:border-ink text-xs font-bold uppercase tracking-widest transition-all rounded-[2px] flex items-center justify-center backdrop-blur-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>START CUSTOM STUDIO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
