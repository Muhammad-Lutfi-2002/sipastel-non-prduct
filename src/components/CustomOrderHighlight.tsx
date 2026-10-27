import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandPlaceholder } from './BrandPlaceholder';

interface CustomOrderHighlightProps {
  onStartCustomOrder: () => void;
}

export const CustomOrderHighlight: React.FC<CustomOrderHighlightProps> = ({
  onStartCustomOrder,
}) => {
  return (
    <section
      id="custom-order-highlight-section"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20 md:py-24"
    >
      <div className="bg-[#1C1B1A] text-ink-soft rounded-[2px] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Column: Studio Copy & Service Specs */}
        <div className="lg:col-span-6 p-8 sm:p-12 md:p-16 flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#A69E8F] block mb-3">
            BESPOKE & BATCH PRODUCTION
          </span>

          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink-soft leading-[1.08] mb-4">
            YOUR DESIGN. YOUR PIECE.
          </h2>

          <p className="text-sm sm:text-base text-[#D8D4CB] leading-relaxed mb-8 max-w-lg">
            Wujudkan identitas tim, komunitas, atau brand Anda bersama studio konveksi kami. Dari katun combed 16s/24s berpotongan boxy, aero jersey lari & sepeda mikro-pori, hingga bordir presisi tinggi.
          </p>

          <div className="space-y-3 mb-10 text-xs sm:text-sm text-[#D8D4CB] border-y border-[#383633] py-6">
            <div className="flex items-start gap-3">
              <span className="text-sage-soft font-bold">—</span>
              <span><strong>Pilihan Kain Premium:</strong> Katun combed 16s (235 gsm), 24s combed, & Dry-Fit Milano 170 gsm.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sage-soft font-bold">—</span>
              <span><strong>Teknik Aplikasi:</strong> Sablon DTF High-Density, Plastisol manual, atau Bordir Komputer presisi.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sage-soft font-bold">—</span>
              <span><strong>Free Digital Mockup:</strong> Preview 2D dikerjakan desainer sebelum konfirmasi produksi massal.</span>
            </div>
          </div>

          <div>
            <button
              id="start-custom-order-cta-btn"
              onClick={onStartCustomOrder}
              className="min-h-[48px] px-8 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest rounded-[2px] transition-all active:scale-[0.99] flex items-center gap-3 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <span>START CUSTOM STUDIO</span>
              <ArrowRight className="w-4 h-4 text-ink-soft transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Right Column: Clean Editorial Studio Visual */}
        <div className="lg:col-span-6 relative min-h-[380px] lg:min-h-full bg-[#2B2A28]">
          {/* Photo slot: a close-up of a finished custom piece (embroidery,
              print detail, or a completed batch order) fits best here. */}
          <BrandPlaceholder variant="clay" />
          {/* Natural atmospheric overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1B1A]/80 via-transparent to-transparent lg:hidden" />

          {/* Editorial Watermark */}
          <div className="absolute bottom-6 left-6 right-6 p-4 bg-[#1C1B1A]/90 backdrop-blur-md rounded-[2px] border border-[#383633] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ink-soft">Tailored for Communities & Brands</p>
              <p className="text-[11px] text-[#A69E8F]">High-Density DTF & Premium Milano Mesh</p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 bg-accent text-on-accent rounded-[1px]">
              Studio
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
