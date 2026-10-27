import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { createWhatsAppUrl } from '../utils/whatsapp';

export const WhatsAppFloatingButton: React.FC = () => {
  const [showBubble, setShowBubble] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 120) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const waUrl = createWhatsAppUrl(
    'Hi SIPASTEL! Saya ingin konsultasi produk dan custom apparel. Boleh dibantu info lebih lanjut?'
  );

  return (
    <div
      id="whatsapp-floating-container"
      className={`fixed bottom-5 left-5 z-40 flex items-center gap-2.5 transition-all duration-300 ${
        hasScrolled ? 'opacity-100 translate-y-0' : 'opacity-90 translate-y-1'
      }`}
    >
      {/* Small popover message */}
      {showBubble && (
        <div
          id="whatsapp-popover"
          className="bg-accent text-on-accent px-3.5 py-2 rounded-xs shadow-lg text-xs flex items-center gap-2 border border-line-strong animate-fade-in"
        >
          <span className="leading-tight">Ada pertanyaan? Chat tim SIPASTEL</span>
          <button
            onClick={() => setShowBubble(false)}
            className="text-muted hover:text-ink-soft p-0.5"
            aria-label="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating icon button */}
      <a
        id="whatsapp-floating-btn"
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowBubble(true)}
        className="w-11 h-11 bg-accent text-on-accent hover:bg-accent-soft rounded-full flex items-center justify-center shadow-md border border-line-strong transition-transform hover:scale-105 active:scale-95"
        aria-label="Chat WhatsApp SIPASTEL"
        title="Chat WhatsApp SIPASTEL"
      >
        <MessageCircle className="w-5 h-5 text-sage-soft" />
      </a>
    </div>
  );
};
