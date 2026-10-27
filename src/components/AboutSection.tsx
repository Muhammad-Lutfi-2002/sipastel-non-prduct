import React from 'react';
import { BrandPlaceholder } from './BrandPlaceholder';

export const AboutSection: React.FC = () => {
  return (
    <section id="about-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-14 sm:py-20 md:py-28">
      {/* Editorial Header */}
      <div className="max-w-3xl mb-12 sm:mb-16">
        <span className="text-xs uppercase tracking-[0.25em] text-muted font-semibold block mb-2">
          THE STUDIO & MANIFESTO
        </span>
        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink leading-[1.08]">
          Tenang di warna, tegas di potongan.
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-body mt-4 leading-relaxed font-normal">
          SIPASTEL didirikan di Bogor dengan premis sederhana: pakaian harian tidak harus bersuara keras untuk terlihat berkarakter. Kami memadukan warna pastel yang meneduhkan dengan siluet boxy kontemporer dan material katun berdensitas tinggi.
        </p>
      </div>

      {/* Studio Story Grid: Real Editorial Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left: Studio Workshop Visual */}
        <div className="lg:col-span-7 relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-[2px] bg-surface-hover border border-line">
          {/* Photo slot: a candid shot of the actual Bogor workshop (cutting
              table, sewing stations, the team at work) fits best here. */}
          <BrandPlaceholder variant="sage" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-3 sm:p-4 bg-paper/95 backdrop-blur-xs border border-line text-ink flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide">
              Workshop Pola & Jahitan — Bogor, Jawa Barat
            </span>
            <span className="text-[11px] uppercase font-bold tracking-widest text-muted hidden sm:inline">
              EST. 2024
            </span>
          </div>
        </div>

        {/* Right: Craft Principles (Editorial paragraphs, no generic cards) */}
        <div className="lg:col-span-5 space-y-8 text-ink">
          <div className="border-t border-line pt-4">
            <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight mb-2">
              Kain Katun Berdensitas Tinggi
            </h3>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              Kami memprioritaskan katun combed 16s (235 gsm) dan 24s dengan penyusutan minimal. Teksturnya mantap, tidak menerawang, dan tetap memiliki sirkulasi udara yang nyaman untuk iklim tropis.
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight mb-2">
              Pola Orisinal Drop-Shoulder
            </h3>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              Setiap ukuran dikembangkan dengan proporsi kerah ganda rapat dan jatuhnya bahu yang santai. Tidak ada pola instan generik; semua dibuat berdasarkan fitting berulang.
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight mb-2">
              Bespoke Studio Tanpa Batasan
            </h3>
            <p className="text-xs sm:text-sm text-body leading-relaxed">
              Mulai dari kaos satuan untuk personal branding hingga jersey technical untuk pelari maraton dan klub sepeda. Kami mendampingi setiap tahap dari layout grafik hingga sampling.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
