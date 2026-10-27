import React, { useState, useEffect } from 'react';
import { X, Ruler } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'KAOS' | 'JERSEY';
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'KAOS',
}) => {
  const [activeTab, setActiveTab] = useState<'KAOS' | 'JERSEY'>(defaultTab);

  // Re-select the requested tab every time the guide is (re)opened - the
  // initial useState value alone would keep showing the previous tab.
  useEffect(() => {
    if (isOpen) setActiveTab(defaultTab);
  }, [isOpen, defaultTab]);

  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const kaosSizes = [
    { size: 'S', width: '48 cm', length: '68 cm', chest: '96 cm', reco: '45–55 kg / 155–165 cm' },
    { size: 'M', width: '51 cm', length: '71 cm', chest: '102 cm', reco: '55–65 kg / 165–172 cm' },
    { size: 'L', width: '54 cm', length: '74 cm', chest: '108 cm', reco: '65–78 kg / 170–178 cm' },
    { size: 'XL', width: '58 cm', length: '77 cm', chest: '116 cm', reco: '78–90 kg / 175–185 cm' },
    { size: 'XXL', width: '62 cm', length: '80 cm', chest: '124 cm', reco: '90–105 kg / 180–190 cm' },
  ];

  const jerseySizes = [
    { size: 'S', width: '49 cm', length: '69 cm', chest: '98 cm', reco: '48–58 kg / 158–168 cm' },
    { size: 'M', width: '52 cm', length: '72 cm', chest: '104 cm', reco: '58–68 kg / 165–175 cm' },
    { size: 'L', width: '55 cm', length: '75 cm', chest: '110 cm', reco: '68–80 kg / 172–180 cm' },
    { size: 'XL', width: '59 cm', length: '78 cm', chest: '118 cm', reco: '80–92 kg / 178–188 cm' },
    { size: 'XXL', width: '63 cm', length: '81 cm', chest: '126 cm', reco: '92–105 kg / 182–192 cm' },
  ];

  const currentData = activeTab === 'KAOS' ? kaosSizes : jerseySizes;

  return (
    <div
      id="size-guide-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        id="size-guide-modal-content"
        className="bg-paper text-ink w-full max-w-2xl rounded-[2px] p-6 md:p-8 shadow-2xl border border-line relative max-h-[90vh] overflow-y-auto animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <Ruler className="w-5 h-5 text-sage-soft" />
            <h3 className="font-heading text-xl font-bold tracking-tight">Size Guide — Panduan Ukuran</h3>
          </div>
          <button
            id="close-size-guide-btn"
            onClick={onClose}
            className="p-1.5 text-body hover:text-ink transition-colors"
            aria-label="Tutup panduan ukuran"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 mt-6 mb-4">
          <button
            id="size-tab-kaos"
            onClick={() => setActiveTab('KAOS')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'KAOS'
                ? 'bg-accent text-on-accent'
                : 'bg-surface-hover text-body hover:text-ink'
            }`}
          >
            T-Shirt / Kaos
          </button>
          <button
            id="size-tab-jersey"
            onClick={() => setActiveTab('JERSEY')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'JERSEY'
                ? 'bg-accent text-on-accent'
                : 'bg-surface-hover text-body hover:text-ink'
            }`}
          >
            Aero Jersey
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-line rounded-xs mt-3">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-surface-hover text-body border-b border-line uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Lebar Dada</th>
                <th className="py-3 px-4">Panjang Baju</th>
                <th className="py-3 px-4 hidden sm:table-cell">Lingkar Dada</th>
                <th className="py-3 px-4">Rekomendasi Postur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {currentData.map((row) => (
                <tr key={row.size} className="hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-4 font-bold text-ink">{row.size}</td>
                  <td className="py-3 px-4 text-heading">{row.width}</td>
                  <td className="py-3 px-4 text-heading">{row.length}</td>
                  <td className="py-3 px-4 text-heading hidden sm:table-cell">{row.chest}</td>
                  <td className="py-3 px-4 text-body text-xs">{row.reco}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 p-4 bg-surface-hover rounded-xs text-xs text-body space-y-1.5 border border-line">
          <p className="font-semibold text-ink">Catatan Pengukuran:</p>
          <p>• Toleransi ukuran jahit konveksi: ± 1 – 1.5 cm karena sifat elastisitas rajutan katun dan micro-mesh.</p>
          <p>• Untuk potongan loose / boxy streetwear, Anda dapat memilih 1 size lebih besar (up-size) dari ukuran reguler Anda.</p>
          <p>• Perlu ukuran custom di luar tabel? Kami melayani custom size chart untuk order kuantiti komunitas.</p>
        </div>
      </div>
    </div>
  );
};
