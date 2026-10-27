import React from 'react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Pilih Siluet & Kategori',
      desc: 'Tentukan jenis apparel: Boxy Combed Tee, Aero Sublimation Jersey, atau apparel kustom lainnya sesuai kebutuhan.',
    },
    {
      num: '02',
      title: 'Unggah Desain & Spesifikasi',
      desc: 'Kirimkan berkas grafis (AI, PSD, PDF, atau PNG) serta tentukan penempatan sablon, warna kain, dan estimasi kuantitas.',
    },
    {
      num: '03',
      title: 'Validasi Mockup & Pembayaran',
      desc: 'Desainer kami menyiapkan mockup visual 2D dan lembar invoice resmi untuk Anda tinjau via WhatsApp sebelum pengerjaan.',
    },
    {
      num: '04',
      title: 'Produksi & Pengiriman Aman',
      desc: 'Pesanan masuk lini potong, cetak/bordir, quality check, hingga dikemas rapi dengan box SIPASTEL menuju alamat Anda.',
    },
  ];

  return (
    <section id="how-it-works-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20 md:py-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 sm:mb-14 pb-4 border-b border-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted font-semibold block mb-1">
            Simple Workflow
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            How We Create.
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted max-w-sm leading-relaxed">
          Alur pemesanan yang transparan, dari eksplorasi ide digital hingga garment fisik siap pakai.
        </p>
      </div>

      {/* 4 Steps Minimalist Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {steps.map((step) => (
          <div key={step.num} className="border-t border-line pt-5 flex flex-col justify-between">
            <div>
              <span className="font-heading text-2xl sm:text-3xl font-extrabold text-muted tracking-tight block mb-3">
                {step.num}
              </span>
              <h3 className="font-heading text-base sm:text-lg font-bold text-ink mb-2 tracking-tight">
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm text-body leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
