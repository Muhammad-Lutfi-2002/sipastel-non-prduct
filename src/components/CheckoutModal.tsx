import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import { CartItem, Order } from '../types';
import { formatIDR, generateOrderId, generateInvoiceNumber } from '../utils/formatters';
import { createWhatsAppUrl, getProductOrderWhatsAppMessage } from '../utils/whatsapp';
import { addStoredOrder } from '../utils/storage';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  onClearCart,
  onOrderSuccess,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Escape + scroll lock only while open. Escape is ignored mid-submission:
  // the order write is already in flight and closing here would hide the
  // outcome from the customer without cancelling anything.
  useEscapeKey(isOpen && !isProcessing, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingEstimate = 15000;
  const total = subtotal + shippingEstimate;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!customerName.trim()) errs.customerName = 'Nama lengkap wajib diisi.';
    if (!whatsapp.trim()) {
      errs.whatsapp = 'Nomor WhatsApp aktif wajib diisi.';
    } else if (whatsapp.replace(/[^0-9]/g, '').length < 9) {
      errs.whatsapp = 'Nomor WhatsApp minimal 9 digit.';
    }
    if (!address.trim()) errs.address = 'Alamat pengiriman wajib diisi.';
    if (!city.trim()) errs.city = 'Kota tujuan pengiriman wajib diisi.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsProcessing(true);
    setSubmitError(null);

    const newOrderId = generateOrderId();
    const invoiceNumber = generateInvoiceNumber(newOrderId);

    const newOrder: Order = {
      id: '', // generated server-side by the database default; unused on insert
      orderId: newOrderId,
      customer: customerName,
      phone: whatsapp,
      email: email || undefined,
      address: address,
      city: city,
      postalCode: postalCode,
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        variantColor: item.color,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: total,
      totalPaid: 0, // server-computed; unused on insert
      remainingBalance: total, // server-computed; unused on insert
      paymentPercentage: 0, // server-computed; unused on insert
      notes: notes,
      paymentStatus: 'BELUM_BAYAR',
      productionStatus: 'WAITING_VALIDATION',
      shippingStatus: 'NOT_SHIPPED',
      invoiceNumber: invoiceNumber,
      createdAt: new Date().toISOString(),
      isCustomOrder: false,
    };

    const result = await addStoredOrder(newOrder);

    if (!result.success) {
      setIsProcessing(false);
      setSubmitError(
        'Gagal menyimpan pesanan. Mohon periksa koneksi internet Anda dan coba lagi. Jika masalah berlanjut, hubungi kami langsung via WhatsApp.'
      );
      return;
    }

    setCompletedOrder(newOrder);
    setIsProcessing(false);
    onClearCart();
    onOrderSuccess(newOrder);
  };

  // SUCCESS SCREEN
  if (completedOrder) {
    const itemsSummary = completedOrder.items
      .map(
        (it) =>
          `• ${it.productName} (${it.variantColor || '-'}, Size ${it.size || '-'}) x${it.quantity}`
      )
      .join('\n');

    const waMsg = getProductOrderWhatsAppMessage({
      orderId: completedOrder.orderId,
      name: completedOrder.customer,
      itemsList: itemsSummary,
      totalFormatted: formatIDR(completedOrder.totalPrice || total),
      shippingAddress: `${completedOrder.address}, ${completedOrder.city} ${completedOrder.postalCode}`,
    });

    const waUrl = createWhatsAppUrl(waMsg);

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-modal-backdrop">
        <div className="bg-paper text-ink w-full max-w-lg rounded-[2px] p-6 sm:p-8 shadow-2xl border border-line animate-modal-content">
          <div className="flex items-center gap-2 text-sage mb-3">
            <CheckCircle2 className="w-6 h-6 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">Pesanan Berhasil Dicatat</span>
          </div>

          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Order Confirmation
          </h2>
          <p className="text-xs text-body mt-1 leading-relaxed">
            Pesanan Anda telah tercatat dalam antrean SIPASTEL. Klik tombol di bawah untuk membuka WhatsApp admin guna verifikasi rekening & pengiriman.
          </p>

          <div className="mt-5 p-4 bg-surface-hover rounded-[2px] border border-line space-y-2 text-xs">
            <div className="flex justify-between pb-2 border-b border-line">
              <span className="text-muted">Order ID:</span>
              <span className="font-mono font-bold text-ink">{completedOrder.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pemesan:</span>
              <span className="font-semibold text-ink">{completedOrder.customer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Total Pembayaran:</span>
              <span className="font-bold text-ink">{formatIDR(completedOrder.totalPrice || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Status:</span>
              <span className="px-2 py-0.5 bg-paper border border-line-strong text-ink font-bold text-[11px] uppercase tracking-wider">
                Menunggu Konfirmasi
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <a
              id="confirm-checkout-wa-btn"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] px-4 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-sage-soft" />
              <span>Continue to WhatsApp</span>
            </a>

            <button
              onClick={() => {
                setCompletedOrder(null);
                onClose();
              }}
              className="w-full py-2.5 text-xs text-body hover:text-ink font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CHECKOUT FORM
  return (
    <div
      id="checkout-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-modal-backdrop"
      onClick={() => {
        if (!isProcessing) onClose();
      }}
    >
      <div
        id="checkout-modal-content"
        className="bg-paper text-ink w-full max-w-2xl rounded-[2px] shadow-2xl border border-line relative my-auto max-h-[92vh] overflow-y-auto p-5 sm:p-8 animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
          <div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">
              Checkout Pesanan
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Lengkapi data pengiriman dan konfirmasi pesanan Anda.
            </p>
          </div>
          <button
            id="close-checkout-btn"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-body hover:text-ink cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Tutup checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePlaceOrder} className="space-y-6">
          {/* Customer Details */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink">
              1. Informasi Pemesan
            </h3>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                Nama Lengkap <span className="text-danger">*</span>
              </label>
              <input
                id="checkout-name-input"
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errors.customerName) setErrors({ ...errors, customerName: '' });
                }}
                placeholder="Nama Anda"
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              />
              {errors.customerName && (
                <p className="text-xs text-danger mt-1">{errors.customerName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                  Nomor WhatsApp <span className="text-danger">*</span>
                </label>
                <input
                  id="checkout-whatsapp-input"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    if (errors.whatsapp) setErrors({ ...errors, whatsapp: '' });
                  }}
                  placeholder="08xxxxxxxxxx"
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
                />
                {errors.whatsapp && (
                  <p className="text-xs text-danger mt-1">{errors.whatsapp}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                  Email (Opsional)
                </label>
                <input
                  id="checkout-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink">
              2. Alamat Pengiriman
            </h3>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                Alamat Lengkap <span className="text-danger">*</span>
              </label>
              <textarea
                id="checkout-address-input"
                rows={2}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errors.address) setErrors({ ...errors, address: '' });
                }}
                placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                className="w-full p-3 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              />
              {errors.address && (
                <p className="text-xs text-danger mt-1">{errors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                  Kota / Kabupaten <span className="text-danger">*</span>
                </label>
                <input
                  id="checkout-city-input"
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors({ ...errors, city: '' });
                  }}
                  placeholder="Contoh: Bogor"
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
                />
                {errors.city && (
                  <p className="text-xs text-danger mt-1">{errors.city}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                  Kode Pos
                </label>
                <input
                  id="checkout-postal-input"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="40123"
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1">
                Catatan Khusus (Opsional)
              </label>
              <input
                id="checkout-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Titipkan di pos satpam jika tidak ada orang"
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-paper border border-line-strong rounded-[2px] text-xs sm:text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Order Summary Box */}
          <div className="p-4 bg-surface-hover rounded-[2px] border border-line space-y-2 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-ink mb-2">
              Ringkasan Pembayaran
            </h4>
            <div className="flex justify-between text-body">
              <span>Subtotal Produk ({cart.reduce((s, i) => s + i.quantity, 0)} item)</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-body">
              <span>Estimasi Ongkir (Jawa Barat & Sekitarnya)</span>
              <span>{formatIDR(shippingEstimate)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-ink pt-2 border-t border-line">
              <span>Total Tagihan</span>
              <span>{formatIDR(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2">
            {submitError && (
              <div className="mb-3 p-3 bg-danger/10 border border-danger/30 rounded-[2px] text-xs text-danger">
                {submitError}
              </div>
            )}
            <button
              id="submit-order-checkout-btn"
              type="submit"
              disabled={isProcessing}
              className="w-full min-h-[48px] px-6 py-3.5 bg-accent hover:bg-accent-soft text-on-accent text-xs font-bold uppercase tracking-widest rounded-[2px] flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Order...</span>
                </>
              ) : (
                <>
                  <span>Konfirmasi & Buat Pesanan</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
