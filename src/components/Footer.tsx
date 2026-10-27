import React from 'react';
import { Instagram, MessageCircle, Mail, MapPin, ArrowUp } from 'lucide-react';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface FooterProps {
  onNavigate: (view: 'home' | 'shop' | 'custom-order' | 'about' | 'how-to-order' | 'contact') => void;
  onOpenTrackOrder: () => void;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenTrackOrder, onOpenAdmin }) => {
  const currentYear = new Date().getFullYear();
  const waHelpUrl = createWhatsAppUrl(
    'Hi SIPASTEL, saya butuh bantuan terkait produk atau pesanan saya.'
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="main-footer" className="bg-paper border-t border-line text-ink pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-line">
          {/* Brand & Description */}
          <div className="md:col-span-4 space-y-4">
            <span className="font-heading font-extrabold text-2xl tracking-tight text-ink block">
              SIPASTEL
            </span>
            <p className="text-xs sm:text-sm text-body leading-relaxed max-w-sm">
              Custom apparel studio & ready-to-wear brand berbasis di Bogor. Menghadirkan siluet pakaian harian dan technical jersey dengan palet warna pastel yang tenang, material berkualitas tinggi, dan pengerjaan yang teliti.
            </p>
            <div className="pt-1 text-xs text-muted flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>Puri Matahari Persada Blok C No. 25, Laladon, Ciomas, Bogor, Jawa Barat</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs font-medium text-body">
              <li>
                <button
                  onClick={() => onNavigate('shop')}
                  className="hover:text-ink transition-colors"
                >
                  Shop Collection
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('custom-order')}
                  className="hover:text-ink transition-colors"
                >
                  Custom Order
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-ink transition-colors"
                >
                  About SIPASTEL
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('how-to-order')}
                  className="hover:text-ink transition-colors"
                >
                  How to Order
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTrackOrder}
                  className="hover:text-ink transition-colors"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-ink transition-colors"
                >
                  Contact & Studio
                </button>
              </li>
              {onOpenAdmin && (
                <li>
                  <button
                    id="footer-admin-btn"
                    onClick={onOpenAdmin}
                    className="text-muted hover:text-ink transition-colors flex items-center gap-1.5 pt-1"
                  >
                    <span>Admin Console</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Social & Contact */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink">
              Social & Community
            </h4>
            <ul className="space-y-2.5 text-xs text-body">
              <li>
                <a
                  href="https://www.instagram.com/sipastel_official/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors flex items-center gap-2"
                >
                  <Instagram className="w-3.5 h-3.5 text-accent" />
                  <span>Instagram @sipastel_official</span>
                </a>
              </li>
              <li>
                <a
                  href={waHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-accent" />
                  <span>WhatsApp Customer Support</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Customer Support Hours */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink">
              Customer Support
            </h4>
            <div className="text-xs text-body space-y-1 leading-relaxed">
              <p className="font-semibold text-ink">Jam Operasional:</p>
              <p>Senin – Sabtu: 09.00 – 20.00 WIB</p>
              <p>Minggu: Konsultasi Terbatas</p>
              <p className="pt-2 text-[11px] text-muted">
                Respon cepat untuk mockup & invoice via WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>© {currentYear} SIPASTEL. All rights reserved. Made in Indonesia.</p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 hover:text-ink transition-colors py-1"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
