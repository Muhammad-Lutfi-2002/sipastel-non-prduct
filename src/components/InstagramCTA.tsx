import React from 'react';
import { Instagram, ArrowUpRight } from 'lucide-react';

export const InstagramCTA: React.FC = () => {
  return (
    <section id="instagram-cta-section" className="w-full bg-surface-hover border-y border-line py-14 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <span className="text-xs uppercase tracking-[0.2em] text-muted font-semibold block mb-2">
          Instagram Community
        </span>

        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-3">
          FOLLOW THE PROCESS.
        </h2>

        <p className="text-sm sm:text-base text-body max-w-lg mx-auto mb-8 leading-relaxed">
          See our latest works, drops and behind-the-scenes on Instagram.
        </p>

        <a
          id="instagram-official-cta-btn"
          href="https://www.instagram.com/sipastel_official/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-8 py-4 bg-accent hover:bg-accent-soft text-on-accent text-xs sm:text-sm font-bold tracking-widest uppercase rounded-xs transition-transform active:scale-[0.99] shadow-xs"
        >
          <Instagram className="w-4 h-4 text-sage-soft" />
          <span>@SIPASTEL_OFFICIAL</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </section>
  );
};
