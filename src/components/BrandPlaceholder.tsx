import React from 'react';
import { Shirt } from 'lucide-react';

// Self-hosted stand-in art for the marketing sections (hero, about, custom
// order highlight, community gallery, category cards). It never fetches
// anything over the network - no dependency on Unsplash or any third party,
// so it can never go blank, get replaced, or leak a visitor's IP/User-Agent
// to an external host.
//
// TODO(studio): swap these for real photography of your workshop, team and
// finished garments once you have a shoot ready - each usage below is
// tagged with what kind of photo belongs there.
const VARIANTS = {
  sage: 'from-[#465C4A] via-[#3A4A3D] to-[#232B25]',
  clay: 'from-[#6B4A3A] via-[#4A342A] to-[#2A1F1A]',
  ink: 'from-[#3A3835] via-[#26241F] to-[#161512]',
  accent: 'from-[color-mix(in_srgb,var(--color-accent)_55%,black)] via-[color-mix(in_srgb,var(--color-accent)_25%,black)] to-[#1A1918]',
} as const;

interface BrandPlaceholderProps {
  variant?: keyof typeof VARIANTS;
  className?: string;
  /** Optional short label rendered over the art, e.g. a category name. */
  label?: string;
  iconClassName?: string;
}

export const BrandPlaceholder: React.FC<BrandPlaceholderProps> = ({
  variant = 'ink',
  className = '',
  label,
  iconClassName = 'w-10 h-10 sm:w-12 sm:h-12',
}) => {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-br ${VARIANTS[variant]} ${className}`}
      role="img"
      aria-label={label ? `Ilustrasi ${label}` : 'Ilustrasi SIPASTEL'}
    >
      {/* Faint repeating garment pattern for texture, purely decorative. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 0, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 0, white 1px, transparent 1px)',
          backgroundSize: '48px 48px, 64px 64px',
        }}
        aria-hidden="true"
      />
      <Shirt className={`${iconClassName} text-ink-soft/25`} strokeWidth={1.2} aria-hidden="true" />
      {label && (
        <span className="absolute bottom-4 left-4 right-4 text-[11px] font-mono uppercase tracking-widest text-ink-soft/50 text-center">
          {label}
        </span>
      )}
    </div>
  );
};
