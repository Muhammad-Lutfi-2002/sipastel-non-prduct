import React, { useState } from 'react';
import { MessageCircle, Instagram, MapPin, Send } from 'lucide-react';
import { createWhatsAppUrl } from '../utils/whatsapp';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('Custom Order Komunitas');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Hi SIPASTEL! Saya ${name || 'Customer'}.
Topik: ${topic}
Pesan: ${message || 'Halo, saya ingin menanyakan seputar produk dan custom apparel SIPASTEL.'}`;
    window.open(createWhatsAppUrl(text), '_blank');
  };

  return (
    <section id="contact-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-14 sm:py-20 md:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
        {/* Contact Info & Studio Details */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-muted font-semibold block mb-2">
              STUDIO & INQUIRIES
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
              Connect with SIPASTEL.
            </h2>
            <p className="text-sm sm:text-base text-body mt-3 leading-relaxed">
              Diskusikan kebutuhan apparel tim Anda, konsultasikan pemilihan kain katun combed vs aero jersey, atau tanyakan ketersediaan katalog siap kirim.
            </p>
          </div>

          <div className="space-y-3 pt-2 text-xs sm:text-sm text-heading">
            <a
              href="https://www.instagram.com/sipastel_official/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 p-4 bg-paper border border-line rounded-[2px] hover:border-accent transition-colors"
            >
              <Instagram className="w-4 h-4 text-sage-soft shrink-0" />
              <div>
                <span className="font-bold text-ink block">Official Instagram</span>
                <span className="text-xs text-muted">@sipastel_official</span>
              </div>
            </a>

            <a
              href={createWhatsAppUrl('Hi SIPASTEL, saya ingin konsultasi produk dan custom order.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 p-4 bg-paper border border-line rounded-[2px] hover:border-accent transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-sage-soft shrink-0" />
              <div>
                <span className="font-bold text-ink block">WhatsApp Customer Care</span>
                <span className="text-xs text-muted">Senin – Sabtu (09.00 – 20.00 WIB)</span>
              </div>
            </a>

            <div className="flex items-start gap-3.5 p-4 bg-paper border border-line rounded-[2px]">
              <MapPin className="w-4 h-4 text-sage-soft shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-ink block">Production Workshop & Studio</span>
                <span className="text-xs text-muted">Puri Matahari Persada Blok C No. 25, Laladon, Ciomas, Bogor, Jawa Barat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Direct WhatsApp Inquiry Message Form */}
        <div className="lg:col-span-7 bg-paper border border-line p-6 sm:p-8 md:p-10 rounded-[2px]">
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-ink mb-1">
            Kirim Pesan Langsung
          </h3>
          <p className="text-xs text-muted mb-6 leading-relaxed">
            Pesan Anda akan otomatis diformat dan diteruskan ke WhatsApp Customer Support kami.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                Nama Anda
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda atau Komunitas"
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                Topik Diskusi
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              >
                <option value="Custom Order Komunitas">Custom Order Apparel / Jersey Komunitas</option>
                <option value="Katalog Produk Siap Pakai">Pertanyaan Produk Ready Stock</option>
                <option value="Cek Status Pesanan">Cek Status Produksi / Pengiriman</option>
                <option value="Kerjasama Brand / B2B">Kerjasama Brand / Vendor B2B</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                Pesan atau Konsep Custom
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan detail pertanyaan, jumlah estimasi, atau konsep grafis yang ingin dibuat..."
                className="w-full px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] px-6 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Send className="w-4 h-4 text-sage-soft" />
              <span>Kirim via WhatsApp</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
