import React from 'react';
import { Instagram, ArrowUpRight } from 'lucide-react';
import { BrandPlaceholder } from './BrandPlaceholder';

export const SocialProofGallery: React.FC = () => {
  // Photo slot: real customer/community photos (reposted with permission)
  // belong here once you have them - this is meant to be a live social
  // proof wall, not permanent placeholder art.
  const photos = [
    { variant: 'sage' as const, tag: 'Heavyweight Boxy Tee — Sage', author: '@subuhrunners', span: 'col-span-1 row-span-2 aspect-[3/4]' },
    { variant: 'clay' as const, tag: 'Custom Aero Jersey Community', author: '@bogorpedalclub', span: 'col-span-1 row-span-1 aspect-square' },
    { variant: 'accent' as const, tag: 'Everyday Minimalist Tee — Oatmeal', author: '@sipastel_official', span: 'col-span-1 row-span-1 aspect-square' },
    { variant: 'ink' as const, tag: 'Vintage Contrast Ringer Tee', author: '@creativestudio.bdg', span: 'col-span-1 row-span-2 aspect-[3/4]' },
    { variant: 'sage' as const, tag: 'Custom Screenprint & Embroidery', author: '@sipastel_official', span: 'col-span-1 row-span-1 aspect-square' },
  ];

  return (
    <section id="social-proof-gallery-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-widest text-muted font-semibold block">
            Community & Stories
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-ink mt-1">
            Made by us. Worn by you.
          </h2>
        </div>

        <a
          href="https://www.instagram.com/sipastel_official/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:underline underline-offset-4"
        >
          <Instagram className="w-4 h-4" />
          <span>Follow @sipastel_official</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Masonry / Editorial Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {photos.map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-[2px] bg-surface-hover border border-line aspect-[3/4]"
          >
            <BrandPlaceholder
              variant={item.variant}
              label={item.tag}
              className="transition-transform duration-500 group-hover:scale-105"
            />
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-[#1A1918]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5 text-ink-soft z-10">
              <p className="text-xs font-bold leading-tight">{item.tag}</p>
              <p className="text-[11px] text-[#D8D4CB] mt-0.5">{item.author}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
