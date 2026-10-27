import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  Clock,
  Layers,
  HelpCircle,
  FileText,
  Loader2,
  X,
  Landmark,
} from 'lucide-react';
import { CustomOrderFormData, Order, Product } from '../types';
import { generateOrderId, generateInvoiceNumber, formatIDR } from '../utils/formatters';
import { createWhatsAppUrl, getCustomOrderWhatsAppMessage } from '../utils/whatsapp';
import { addStoredOrder, uploadDesignFile, getStoredStudioProfile, getStoredProducts, StudioProfile, MAX_DESIGN_FILE_BYTES } from '../utils/storage';
import { validateUpload } from '../utils/upload';

interface CustomOrderFormProps {
  onSuccessOrder?: (order: Order) => void;
  onOrderSubmitted?: (order: Order) => void;
  onClose?: () => void;
  onOpenSizeGuide?: (category: 'KAOS' | 'JERSEY') => void;
  onBrowseShop?: () => void;
}

const DP_PERCENTAGE_OPTIONS = [20, 30, 50];

export const CustomOrderForm: React.FC<CustomOrderFormProps> = ({
  onSuccessOrder,
  onOrderSubmitted,
  onClose,
  onOpenSizeGuide,
  onBrowseShop,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Bank info shown at the Review step so the customer knows where to
  // transfer. Fetched from Supabase (public read, see studio_profile RLS)
  // rather than hardcoded, so it always reflects whatever the admin has
  // set in Settings.
  const [studioProfile, setStudioProfile] = useState<StudioProfile | null>(null);

  // Product catalog with live prices, fully managed by Admin/Owner in
  // "Katalog & Stok". Fetched fresh every time the form mounts (public
  // read, RLS-restricted writes) so a price change or a product being
  // deactivated shows up for the very next customer automatically -
  // there is nothing to redeploy.
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  useEffect(() => {
    getStoredStudioProfile().then(setStudioProfile);
    getStoredProducts().then((products) => {
      setCatalogProducts(products.filter((p) => p.inStock));
      setIsLoadingCatalog(false);
    });
  }, []);

  // Form state
  const [formData, setFormData] = useState<CustomOrderFormData>({
    customerName: '',
    whatsappNumber: '',
    email: '',
    productType: 'Kaos',
    quantity: 12,
    size: 'Campur (S, M, L, XL)',
    color: 'Dusty Sage & Warm Oatmeal',
    materialVariant: 'Combed Cotton 16s Heavyweight',
    designFile: null,
    designPreviewUrl: null,
    designDescription: '',
    additionalNotes: '',
    referenceUrl: '',
    shippingAddress: '',
    city: '',
    postalCode: '',
    paymentPreference: null,
    paymentPreferencePercentage: null,
    selectedProductId: null,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingOrderIdRef = useRef<string | null>(null);
  const uploadedDesignRef = useRef<string | null>(null);

  // Live pricing, derived from the selected catalog product + quantity.
  // Recomputes automatically whenever the customer changes either, so the
  // total on screen is always in sync (e.g. Kaos DTF 24s Logo Only
  // Rp55.000 x 30 pcs = Rp1.650.000).
  const selectedProduct = catalogProducts.find((p) => p.id === formData.selectedProductId) ?? null;
  const totalPrice = selectedProduct ? selectedProduct.price * formData.quantity : 0;
  const hasChosenPayment =
    formData.paymentPreference === 'LUNAS' ||
    (formData.paymentPreference === 'DP' && !!formData.paymentPreferencePercentage);
  const dpAmount = !hasChosenPayment
    ? 0
    : formData.paymentPreference === 'DP'
    ? Math.round((totalPrice * (formData.paymentPreferencePercentage ?? 0)) / 100)
    : totalPrice;
  const remainingAfterDp = totalPrice - dpAmount;
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = formData.designPreviewUrl;

  // Release the object URL for the uploaded design preview if the user
  // navigates away without removing the file, preventing a memory leak.
  // Uses a ref so the cleanup always sees the latest preview URL rather than
  // the one captured when the effect was first created.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const stepsList = [
    { num: 1, label: 'Customer Info' },
    { num: 2, label: 'Product' },
    { num: 3, label: 'Specification' },
    { num: 4, label: 'Design' },
    { num: 5, label: 'Request' },
    { num: 6, label: 'Delivery' },
    { num: 7, label: 'Review' },
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    // Check the file's real content (magic bytes), not just its name/MIME -
    // both of those are chosen by the sender.
    const checked = await validateUpload(file, {
      allowed: ['png', 'jpeg', 'pdf', 'psd'],
      maxBytes: MAX_DESIGN_FILE_BYTES,
    });

    if (!checked.ok) {
      setErrors((prev) => ({
        ...prev,
        designFile: checked.error.startsWith('Format')
          ? 'Format file tidak didukung. Harap upload PNG, JPG, PDF, atau PSD.'
          : checked.error,
      }));
      return;
    }

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.designFile;
      return copy;
    });

    // A different file invalidates any upload from an earlier failed submit.
    uploadedDesignRef.current = null;

    const isImage = checked.kind === 'png' || checked.kind === 'jpeg';
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    // Revoke the previous object URL (if any) before creating a new one, so
    // replacing a file doesn't leak the old blob URL for the page's lifetime.
    setFormData((prev) => {
      if (prev.designPreviewUrl) {
        URL.revokeObjectURL(prev.designPreviewUrl);
      }
      return {
        ...prev,
        designFile: file,
        designPreviewUrl: previewUrl,
      };
    });

    // Animate upload progress 0% -> 100%
    setUploadProgress(25);
    setTimeout(() => setUploadProgress(70), 120);
    setTimeout(() => setUploadProgress(100), 280);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (step === 1) {
      if (!formData.customerName.trim()) {
        newErrors.customerName = 'Nama wajib diisi.';
      }
      if (formData.customerName.trim().length > 100) {
        newErrors.customerName = 'Nama maksimal 100 karakter.';
      }
      if (!formData.whatsappNumber.trim()) {
        newErrors.whatsappNumber = 'Nomor WhatsApp aktif wajib diisi.';
      } else if (formData.whatsappNumber.replace(/[^0-9]/g, '').length < 9) {
        newErrors.whatsappNumber = 'Nomor WhatsApp minimal 9 digit angka.';
      } else if (formData.whatsappNumber.replace(/[^0-9]/g, '').length > 15) {
        newErrors.whatsappNumber = 'Nomor WhatsApp maksimal 15 digit angka.';
      }
      if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Format email tidak valid.';
      }
    } else if (step === 2) {
      if (!formData.selectedProductId) {
        newErrors.selectedProductId = 'Pilih salah satu produk dari katalog terlebih dahulu.';
      }
      if (!Number.isInteger(Number(formData.quantity)) || formData.quantity < 1) {
        newErrors.quantity = 'Kuantitas minimal 1 pcs (angka bulat).';
      } else if (formData.quantity > 100000) {
        newErrors.quantity = 'Kuantitas terlalu besar. Hubungi kami via WhatsApp untuk pesanan partai besar.';
      }
    } else if (step === 3) {
      if (!formData.size.trim()) {
        newErrors.size = 'Spesifikasi ukuran wajib diisi.';
      }
      if (!formData.color.trim()) {
        newErrors.color = 'Pilihan warna wajib diisi.';
      }
    } else if (step === 5) {
      if (!formData.designDescription.trim()) {
        newErrors.designDescription = 'Jelaskan ringkasan konsep desain yang Anda inginkan.';
      } else if (formData.designDescription.length > 2000) {
        newErrors.designDescription = 'Deskripsi maksimal 2000 karakter.';
      }
      if (formData.additionalNotes.length > 2000) {
        newErrors.additionalNotes = 'Catatan maksimal 2000 karakter.';
      }
    } else if (step === 6) {
      if (!formData.shippingAddress.trim()) {
        newErrors.shippingAddress = 'Alamat lengkap pengiriman wajib diisi.';
      }
      if (!formData.city.trim()) {
        newErrors.city = 'Kota tujuan wajib diisi.';
      }
      if (formData.shippingAddress.length > 500) {
        newErrors.shippingAddress = 'Alamat maksimal 500 karakter.';
      }
      if (formData.postalCode.trim() && !/^\d{5}$/.test(formData.postalCode.trim())) {
        newErrors.postalCode = 'Kode pos harus 5 digit angka.';
      }
    } else if (step === 7) {
      if (!formData.paymentPreference) {
        newErrors.paymentPreference = 'Pilih DP atau Lunas terlebih dahulu sebelum mengirim pesanan.';
      } else if (formData.paymentPreference === 'DP' && !formData.paymentPreferencePercentage) {
        newErrors.paymentPreference = 'Pilih persentase DP terlebih dahulu sebelum mengirim pesanan.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pressing Enter in a field of an earlier step must move forward, not
    // submit a half-filled order.
    if (currentStep < totalSteps) {
      handleNext();
      return;
    }
    if (isSubmitting || !validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Reuse the same order ID on retry so a failed submit followed by a
    // second attempt cannot create two different orders.
    if (!pendingOrderIdRef.current) pendingOrderIdRef.current = generateOrderId();
    const newOrderId = pendingOrderIdRef.current;
    const invoiceNum = generateInvoiceNumber(newOrderId);

    // Upload the design file (if any) so the admin panel has a permanent URL
    // - a blob: preview URL only exists in this browser tab. If an earlier
    // attempt already uploaded it, don't upload a duplicate.
    let uploadedDesignUrl: string | null = uploadedDesignRef.current;
    if (formData.designFile && !uploadedDesignUrl) {
      const upload = await uploadDesignFile(formData.designFile, newOrderId);
      if (!upload.success || !upload.url) {
        setIsSubmitting(false);
        setSubmitError(
          `${upload.error ?? 'Gagal mengunggah file desain Anda.'} Periksa koneksi internet dan coba lagi, atau kirimkan file desain langsung via WhatsApp setelah submit.`
        );
        return;
      }
      uploadedDesignUrl = upload.url;
      uploadedDesignRef.current = upload.url;
    }

    const resolvedProductName = selectedProduct?.name ?? formData.productType;

    const newOrder: Order = {
      id: '', // generated server-side by the database default; unused on insert
      orderId: newOrderId,
      customer: formData.customerName,
      phone: formData.whatsappNumber,
      email: formData.email,
      address: formData.shippingAddress,
      city: formData.city,
      postalCode: formData.postalCode,
      items: [
        {
          // productId lets the database re-check the price against the
          // catalog instead of trusting the total sent from the browser.
          productId: selectedProduct?.id,
          productName: `${resolvedProductName} — ${formData.color}`,
          category: 'CUSTOM',
          variantColor: formData.color,
          size: formData.size,
          quantity: Number(formData.quantity),
        },
      ],
      quantity: Number(formData.quantity),
      totalPrice, // known upfront now - catalog price x quantity, live-calculated in Step 2
      totalPaid: 0, // server-computed; unused on insert
      remainingBalance: 0, // server-computed; unused on insert (defaults to totalPrice server-side)
      paymentPercentage: 0, // server-computed; unused on insert
      design: uploadedDesignUrl,
      designFileName: formData.designFile ? formData.designFile.name : null,
      notes: formData.additionalNotes,
      request: `${formData.designDescription}. Bahan: ${formData.materialVariant}. Ukuran: ${formData.size}`,
      productType: resolvedProductName,
      material: formData.materialVariant,
      sizeSpec: formData.size,
      colorSpec: formData.color,
      paymentStatus: 'BELUM_BAYAR',
      // Guaranteed non-null here: validateStep(7) blocks submission until
      // the customer has actively chosen one, so these fallbacks never
      // actually apply at runtime - they only satisfy the stricter
      // (nullable) form-state type.
      paymentPreference: formData.paymentPreference ?? 'DP',
      paymentPreferencePercentage:
        formData.paymentPreference === 'DP' ? formData.paymentPreferencePercentage ?? 50 : 100,
      productionStatus: 'WAITING_VALIDATION',
      shippingStatus: 'NOT_SHIPPED',
      invoiceNumber: invoiceNum,
      createdAt: new Date().toISOString(),
      isCustomOrder: true,
    };

    const result = await addStoredOrder(newOrder);

    if (!result.success) {
      setIsSubmitting(false);
      setSubmitError(
        `Gagal mengirim pesanan custom Anda.${result.error ? ` ${result.error}` : ''} Mohon periksa koneksi internet dan coba lagi, atau hubungi kami langsung via WhatsApp.`
      );
      return;
    }

    setSubmittedOrder(newOrder);
    setIsSubmitting(false);

    if (onSuccessOrder) {
      onSuccessOrder(newOrder);
    }
    if (onOrderSubmitted) {
      onOrderSubmitted(newOrder);
    }
  };

  // SUCCESS CONFIRMATION SCREEN
  if (submittedOrder) {
    const orderTotal = submittedOrder.totalPrice ?? 0;
    const orderDpPct = submittedOrder.paymentPreferencePercentage ?? 50;
    const orderPayNow =
      submittedOrder.paymentPreference === 'LUNAS' ? orderTotal : Math.round((orderTotal * orderDpPct) / 100);
    const orderRemaining = orderTotal - orderPayNow;
    const unitPrice = submittedOrder.quantity > 0 ? orderTotal / submittedOrder.quantity : 0;

    const waMessage = getCustomOrderWhatsAppMessage({
      orderId: submittedOrder.orderId,
      name: submittedOrder.customer,
      product: submittedOrder.productType || 'Custom Apparel',
      quantity: `${submittedOrder.quantity} pcs`,
      request: submittedOrder.request || formData.designDescription,
      paymentPreference: submittedOrder.paymentPreference ?? 'DP',
      paymentPreferencePercentage: orderDpPct,
      bankName: studioProfile?.bankName,
      bankAccountNumber: studioProfile?.bankAccountNumber,
      bankAccountHolder: studioProfile?.bankAccountHolder,
      pricePerUnitFormatted: orderTotal > 0 ? formatIDR(unitPrice) : undefined,
      totalPriceFormatted: orderTotal > 0 ? formatIDR(orderTotal) : undefined,
      payNowFormatted: orderTotal > 0 ? formatIDR(orderPayNow) : undefined,
      remainingFormatted: orderTotal > 0 ? formatIDR(orderRemaining) : undefined,
    });
    const waUrl = createWhatsAppUrl(waMessage);

    return (
      <div id="custom-order-confirmation" className="w-full max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-paper border border-line p-6 sm:p-10 rounded-xs shadow-sm">
          {/* Header Badge */}
          <div className="flex items-center gap-2.5 text-sage mb-4">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-widest">Custom Order Diterima</span>
          </div>

          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Your request has been received.
          </h2>

          <p className="text-sm sm:text-base text-body mt-2 leading-relaxed">
            Terima kasih telah mempercayakan produksi pakaian custom Anda kepada SIPASTEL. Tim kami telah menerima spesifikasi dan file desain Anda.
          </p>

          {/* Details Card */}
          <div className="mt-8 p-5 bg-surface-hover rounded-xs border border-line space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">Order ID</span>
              <span className="font-mono text-base font-bold text-ink">{submittedOrder.orderId}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <span className="text-muted block text-xs">Customer</span>
                <span className="font-semibold text-ink">{submittedOrder.customer}</span>
              </div>
              <div>
                <span className="text-muted block text-xs">Produk & Qty</span>
                <span className="font-semibold text-ink">
                  {submittedOrder.productType} ({submittedOrder.quantity} pcs)
                </span>
              </div>
              <div>
                <span className="text-muted block text-xs">Status Produksi</span>
                <span className="inline-block px-2 py-0.5 mt-0.5 bg-sage/10 text-sage font-semibold text-[11px] rounded-xs">
                  WAITING_VALIDATION
                </span>
              </div>
              <div>
                <span className="text-muted block text-xs">Estimasi Respon</span>
                <span className="font-semibold text-ink flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-sage-soft" />
                  1–2 Jam Kerja
                </span>
              </div>
            </div>
          </div>

          {/* Price & Payment Breakdown Card */}
          {orderTotal > 0 && (
            <div className="mt-4 p-5 bg-surface-hover rounded-xs border border-line space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-line">
                <Landmark className="w-4 h-4 text-sage-soft" />
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Ringkasan Harga & Pembayaran
                </span>
              </div>

              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-body">
                  <span>Total Harga</span>
                  <span className="font-semibold text-ink">{formatIDR(orderTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-body">
                  <span>
                    {submittedOrder.paymentPreference === 'LUNAS'
                      ? 'Dibayar Sekarang (Lunas)'
                      : `DP (${orderDpPct}%) — Dibayar Sekarang`}
                  </span>
                  <span className="font-bold text-accent">{formatIDR(orderPayNow)}</span>
                </div>
                {submittedOrder.paymentPreference === 'DP' && (
                  <div className="flex items-center justify-between text-body">
                    <span>Sisa Pembayaran (Pelunasan)</span>
                    <span className="font-semibold text-ink">{formatIDR(orderRemaining)}</span>
                  </div>
                )}
              </div>

              {studioProfile?.bankAccountNumber && (
                <div className="pt-3 border-t border-line text-xs sm:text-sm">
                  <span className="text-muted block mb-1">
                    Transfer {formatIDR(orderPayNow)} ke Rekening Berikut
                  </span>
                  <p className="font-bold text-ink">
                    {studioProfile.bankName} — {studioProfile.bankAccountNumber}
                  </p>
                  <p className="text-body">a.n. {studioProfile.bankAccountHolder}</p>
                  <p className="text-[11px] text-muted mt-1.5">
                    Info rekening ini dikelola langsung oleh admin studio dan selalu ter-update otomatis.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action WhatsApp Callout */}
          <div className="mt-8 space-y-3">
            <a
              id="confirm-custom-order-wa-btn"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 bg-accent hover:bg-accent-soft text-on-accent text-sm font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 rounded-xs shadow-xs"
            >
              <MessageCircle className="w-4 h-4 text-sage-soft" />
              <span>Contact Us on WhatsApp</span>
            </a>

            <p className="text-center text-xs text-muted">
              Klik tombol di atas untuk langsung mengirim detail pesanan ke WhatsApp admin SIPASTEL beserta format konfirmasi otomatis.
            </p>
          </div>

          {/* Additional Actions */}
          <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
            <button
              onClick={() => {
                if (formData.designPreviewUrl) {
                  URL.revokeObjectURL(formData.designPreviewUrl);
                }
                setSubmittedOrder(null);
                setCurrentStep(1);
                setFormData({
                  customerName: '',
                  whatsappNumber: '',
                  email: '',
                  productType: 'Kaos',
                  quantity: 12,
                  size: 'Campur (S, M, L, XL)',
                  color: 'Dusty Sage & Warm Oatmeal',
                  materialVariant: 'Combed Cotton 16s Heavyweight',
                  designFile: null,
                  designPreviewUrl: null,
                  designDescription: '',
                  additionalNotes: '',
                  referenceUrl: '',
                  shippingAddress: '',
                  city: '',
                  postalCode: '',
                  paymentPreference: null,
                  paymentPreferencePercentage: null,
                  selectedProductId: null,
                });
              }}
              className="text-heading hover:text-ink font-semibold underline"
            >
              Buat Custom Order Lainnya
            </button>

            {onBrowseShop && (
              <button
                onClick={onBrowseShop}
                className="text-heading hover:text-ink font-semibold underline"
              >
                Lihat Katalog Produk Siap Pakai
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // WIZARD FORM
  return (
    <div id="custom-order-page-section" className="w-full">
      {onClose && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form custom order"
            className="p-2 -mr-2 text-body hover:text-ink cursor-pointer rounded-[2px] hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {/* Modern Stepper Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none">
          {stepsList.map((step) => {
            const isPassed = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num < currentStep) {
                    setCurrentStep(step.num);
                  }
                }}
                className={`flex items-center gap-2 shrink-0 px-2 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isCurrent
                    ? 'text-ink border-b-2 border-accent'
                    : isPassed
                    ? 'text-body cursor-pointer'
                    : 'text-muted cursor-not-allowed'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] transition-all duration-200 ${
                    isCurrent
                      ? 'bg-accent text-on-accent scale-105'
                      : isPassed
                      ? 'bg-sage-soft text-ink-soft'
                      : 'bg-surface-hover text-muted'
                  }`}
                >
                  {isPassed ? '✓' : `0${step.num}`}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
        {/* Animated continuous progress track */}
        <div className="w-full h-[2px] bg-line mt-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-paper border border-line p-6 sm:p-8 md:p-10 rounded-xs shadow-xs">
        <form onSubmit={handleSubmit}>
          {/* STEP 01: Customer Information */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 01 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Customer Information
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Informasi kontak untuk update mockup desain dan proses produksi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Nama Lengkap <span className="text-danger">*</span>
                </label>
                <input
                  id="custom-order-name-input"
                  type="text"
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData({ ...formData, customerName: e.target.value })
                  }
                  placeholder="Contoh: Dimas Aditya"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.customerName && (
                  <p className="text-xs text-danger mt-1">{errors.customerName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Nomor WhatsApp Aktif <span className="text-danger">*</span>
                </label>
                <input
                  id="custom-order-whatsapp-input"
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsappNumber: e.target.value })
                  }
                  placeholder="Contoh: 081234567890"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                <p className="text-[11px] text-muted mt-1">
                  Kami akan mengirimkan preview preview digital mockup via WhatsApp.
                </p>
                {errors.whatsappNumber && (
                  <p className="text-xs text-danger mt-1">{errors.whatsappNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Email (Opsional)
                </label>
                <input
                  id="custom-order-email-input"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Contoh: dimas@gmail.com"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.email && <p className="text-xs text-danger mt-1">{errors.email}</p>}
              </div>
            </div>
          )}

          {/* STEP 02: Product & Quantity */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 02 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Pilih Produk & Jumlah
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Harga selalu terbaru, dikelola langsung oleh admin studio.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-2.5">
                  Produk <span className="text-danger">*</span>
                </label>

                {isLoadingCatalog ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 rounded-xs bg-surface-hover animate-pulse" />
                    ))}
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="p-4 rounded-xs border border-line bg-paper text-xs text-muted">
                    Belum ada produk aktif di katalog saat ini. Hubungi admin studio via WhatsApp untuk penawaran
                    langsung.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catalogProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, selectedProductId: product.id })}
                        className={`flex items-center gap-3 p-3 rounded-xs border text-left transition-all ${
                          formData.selectedProductId === product.id
                            ? 'border-accent bg-surface-hover ring-1 ring-accent'
                            : 'border-line bg-paper hover:border-line-strong'
                        }`}
                      >
                        {product.images?.[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-12 h-12 rounded-xs object-cover border border-line shrink-0 bg-white"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-sm text-ink truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {product.shortDescription || product.category}
                          </p>
                          <p className="text-sm font-bold text-danger mt-0.5">
                            {formatIDR(product.price)}{' '}
                            <span className="text-[11px] font-normal text-muted">/ pcs</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.selectedProductId && (
                  <p className="text-xs text-danger mt-1">{errors.selectedProductId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Jumlah / Quantity (Pcs) <span className="text-danger">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="custom-order-quantity-input"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-36 px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm font-semibold text-ink focus:outline-none focus:border-accent"
                  />
                  <span className="text-xs text-body">
                    (Minimum order mulai 1 pcs untuk sample mockup, diskon bertingkat untuk 12+ pcs)
                  </span>
                </div>
                {errors.quantity && (
                  <p className="text-xs text-danger mt-1">{errors.quantity}</p>
                )}
              </div>

              {/* Live running total - recalculates instantly as product/quantity change */}
              {selectedProduct && (
                <div className="bg-surface-hover p-4 rounded-xs border border-line">
                  <div className="flex items-center justify-between text-xs text-body">
                    <span>
                      {selectedProduct.name} — {formatIDR(selectedProduct.price)} × {formData.quantity} pcs
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
                    <span className="text-xs font-bold uppercase tracking-wider text-heading">
                      Total Harga
                    </span>
                    <span className="font-heading text-lg font-bold text-ink">
                      {formatIDR(totalPrice)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 03: Specification */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 03 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Spesifikasi Produk
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Tentukan bahan kain, ukuran, dan palet warna dasar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Pilihan Bahan / Varian Kain <span className="text-danger">*</span>
                </label>
                <select
                  value={formData.materialVariant}
                  onChange={(e) =>
                    setFormData({ ...formData, materialVariant: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink focus:outline-none focus:border-accent"
                >
                  <option value="Combed Cotton 16s Heavyweight">
                    Combed Cotton 16s Heavyweight (235 gsm - Tebal & Kokoh)
                  </option>
                  <option value="Combed Cotton 24s Premium Soft">
                    Combed Cotton 24s Premium Soft (180 gsm - Lembut & Adem)
                  </option>
                  <option value="Dry-Fit Milano Micro-Mesh">
                    Dry-Fit Milano Micro-Mesh (Jersey Olahraga & Komunitas)
                  </option>
                  <option value="Dry-Fit Bilabong Anti-UV">
                    Dry-Fit Bilabong Anti-UV (Running & Cycling)
                  </option>
                  <option value="French Terry Premium 280 gsm">
                    French Terry Premium 280 gsm (Sweater / Crewneck)
                  </option>
                  <option value="Konsultasikan dengan Admin">
                    Rekomendasi Bahan dari Tim SIPASTEL
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Rincian Ukuran / Size Breakdown <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) =>
                    setFormData({ ...formData, size: e.target.value })
                  }
                  placeholder="Contoh: S: 4 pcs, M: 8 pcs, L: 10 pcs, XL: 2 pcs"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.size && (
                  <p className="text-xs text-danger mt-1">{errors.size}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Warna Kain / Aksen Pastel <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="Contoh: Sage Green, Warm Oatmeal, Charcoal, atau Mist Blue"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.color && (
                  <p className="text-xs text-danger mt-1">{errors.color}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 04: Upload Design */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 04 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Unggah Desain
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Upload file desain atau logo Anda. Format didukung: PNG, JPG, PDF, PSD (Maks. 3MB).
                </p>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload file desain atau logo, klik atau seret file ke area ini"
                className={`border-2 border-dashed rounded-xs p-8 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  isDragging
                    ? 'border-accent bg-surface-hover'
                    : 'border-line-strong hover:border-accent bg-surface'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.psd"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-body">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-ink mt-2">
                    Drag and drop file desain ke sini, atau klik untuk memilih file
                  </p>
                  <p className="text-xs text-muted">
                    PNG, JPG, PDF, PSD (Resolusi 300 DPI disarankan untuk hasil cetak tajam)
                  </p>
                </div>
              </div>

              {/* Preview if uploaded */}
              {formData.designFile && (
                <div className="p-4 bg-surface-hover rounded-xs border border-line-strong space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {formData.designPreviewUrl ? (
                        <img
                          src={formData.designPreviewUrl}
                          alt="Preview Desain"
                          className="w-12 h-12 object-cover rounded-xs border border-line-strong"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-surface-hover flex items-center justify-center rounded-xs text-body">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-ink truncate max-w-[200px] sm:max-w-xs">
                            {formData.designFile.name}
                          </p>
                          <span className="px-1.5 py-0.5 text-[11px] uppercase font-bold tracking-widest bg-surface-hover text-heading rounded-[2px]">
                            {formData.designFile.name.split('.').pop()?.toUpperCase() || 'FILE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          {(formData.designFile.size / (1024 * 1024)).toFixed(2)} MB • {uploadProgress === 100 ? 'Siap diverifikasi' : 'Mengunggah...'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => {
                          if (prev.designPreviewUrl) {
                            URL.revokeObjectURL(prev.designPreviewUrl);
                          }
                          return {
                            ...prev,
                            designFile: null,
                            designPreviewUrl: null,
                          };
                        });
                        setUploadProgress(0);
                      }}
                      className="text-xs text-danger hover:text-danger/80 font-semibold hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>

                  {/* Animated Upload Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-muted">
                      <span>Upload Status</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sage transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {errors.designFile && (
                <p className="text-xs text-danger">{errors.designFile}</p>
              )}

              <p className="text-xs text-muted">
                *Belum memiliki desain jadi? Jangan khawatir, Anda dapat mendeskripsikan ide Anda di langkah berikutnya atau mengirimkannya via WhatsApp nanti.
              </p>
            </div>
          )}

          {/* STEP 05: Request Details */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 05 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Design Request & Notes
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Berikan arahan penempatan sablon/bordir dan instruksi khusus lainnya.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Deskripsi Desain & Penempatan <span className="text-danger">*</span>
                </label>
                <textarea
                  id="custom-order-request-input"
                  rows={4}
                  value={formData.designDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      designDescription: e.target.value,
                    })
                  }
                  placeholder="Contoh: Sablon logo di dada kiri ukuran 8x8cm (DTF tekstur doff) dan grafis tipografi di punggung tengah ukuran A3. Aksen jahitan benang warna sage green."
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.designDescription && (
                  <p className="text-xs text-danger mt-1">
                    {errors.designDescription}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Catatan Tambahan (Packaging, Label Woven, Deadline Acara)
                </label>
                <textarea
                  rows={2}
                  value={formData.additionalNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      additionalNotes: e.target.value,
                    })
                  }
                  placeholder="Contoh: Perlu selesai sebelum tanggal 25 untuk event komunitas lari. Sertakan stiker pack."
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.additionalNotes && <p className="text-xs text-danger mt-1">{errors.additionalNotes}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Link Referensi / Moodboard (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.referenceUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, referenceUrl: e.target.value })
                  }
                  placeholder="Contoh: https://pin.it/... atau link Google Drive"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* STEP 06: Delivery */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 06 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Delivery Destination
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Alamat pengiriman hasil produksi setelah melalui Quality Control (QC).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                  Alamat Lengkap <span className="text-danger">*</span>
                </label>
                <textarea
                  id="custom-order-address-input"
                  rows={3}
                  value={formData.shippingAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shippingAddress: e.target.value,
                    })
                  }
                  placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                  className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                />
                {errors.shippingAddress && (
                  <p className="text-xs text-danger mt-1">
                    {errors.shippingAddress}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                    Kota / Kabupaten <span className="text-danger">*</span>
                  </label>
                  <input
                    id="custom-order-city-input"
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Contoh: Bogor"
                    className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                  />
                  {errors.city && (
                    <p className="text-xs text-danger mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-heading mb-1.5">
                    Kode Pos
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Contoh: 40115"
                    className="w-full px-4 py-3 bg-paper border border-line-strong rounded-xs text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
                  />
                  {errors.postalCode && <p className="text-xs text-danger mt-1">{errors.postalCode}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 07: Review & Submit */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-line pb-3 mb-5">
                <span className="text-[11px] font-bold text-sage-soft uppercase tracking-widest">
                  LANGKAH 07 DARI 07
                </span>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink mt-1">
                  Tinjau Pesanan Custom
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Tinjau kembali ringkasan pesanan custom Anda sebelum dikirimkan ke sistem produksi SIPASTEL.
                </p>
              </div>

              <div className="bg-surface-hover p-5 rounded-xs border border-line space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-line">
                  <div>
                    <span className="text-xs text-muted block">Pemesan</span>
                    <p className="font-bold text-ink">{formData.customerName}</p>
                    <p className="text-body">{formData.whatsappNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Tujuan Pengiriman</span>
                    <p className="font-medium text-ink">{formData.shippingAddress}</p>
                    <p className="text-body">
                      {formData.city} {formData.postalCode ? `, ${formData.postalCode}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-line">
                  <div>
                    <span className="text-xs text-muted block">Produk & Jumlah</span>
                    <p className="font-bold text-ink">
                      {selectedProduct?.name ?? formData.productType} — {formData.quantity} pcs
                    </p>
                    <p className="text-body">
                      {selectedProduct ? `${formatIDR(selectedProduct.price)} / pcs` : ''} · Bahan: {formData.materialVariant}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Warna & Ukuran</span>
                    <p className="text-ink">Warna: {formData.color}</p>
                    <p className="text-body">Ukuran: {formData.size}</p>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="flex items-center justify-between pb-4 border-b border-line">
                    <span className="text-xs font-bold uppercase tracking-wider text-heading">
                      Total Harga
                    </span>
                    <span className="font-heading text-lg font-bold text-ink">
                      {formatIDR(totalPrice)}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-xs text-muted block">Desain & Catatan</span>
                  <p className="text-ink mt-1">{formData.designDescription}</p>
                  {formData.designFile && (
                    <p className="text-xs text-sage mt-1 flex items-center gap-1 font-medium">
                      <FileCheck className="w-3.5 h-3.5" />
                      File terlampir: {formData.designFile.name}
                    </p>
                  )}
                  {formData.additionalNotes && (
                    <p className="text-xs text-muted mt-1">
                      Catatan: {formData.additionalNotes}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-surface-hover p-5 rounded-xs border border-line space-y-4">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sage-soft" />
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Preferensi Pembayaran <span className="text-danger">*</span>
                  </span>
                </div>
                <p className="text-xs text-muted -mt-2">
                  Total harga sudah pasti berdasarkan katalog di atas. Silakan pilih mau bayar DP atau lunas
                  sekarang — pembayaran aktual tetap dikonfirmasi manual oleh admin setelah dana diterima.
                </p>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentPreference: 'DP' })}
                    className={`py-2.5 px-4 rounded-xs text-xs font-semibold uppercase tracking-wider border transition-colors ${
                      formData.paymentPreference === 'DP'
                        ? 'bg-accent text-on-accent border-accent'
                        : 'bg-paper text-body border-line-strong hover:bg-surface-hover'
                    }`}
                  >
                    DP (Uang Muka)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, paymentPreference: 'LUNAS', paymentPreferencePercentage: 100 })
                    }
                    className={`py-2.5 px-4 rounded-xs text-xs font-semibold uppercase tracking-wider border transition-colors ${
                      formData.paymentPreference === 'LUNAS'
                        ? 'bg-accent text-on-accent border-accent'
                        : 'bg-paper text-body border-line-strong hover:bg-surface-hover'
                    }`}
                  >
                    Lunas (Bayar Penuh)
                  </button>
                </div>

                {formData.paymentPreference === 'DP' && (
                  <div>
                    <span className="text-[11px] font-mono uppercase text-muted mb-1.5 block">
                      Pilih Persentase DP <span className="text-danger">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DP_PERCENTAGE_OPTIONS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setFormData({ ...formData, paymentPreferencePercentage: pct })}
                          className={`py-2 px-4 rounded-xs text-xs font-semibold border transition-colors ${
                            formData.paymentPreferencePercentage === pct
                              ? 'bg-sage text-ink-soft border-sage'
                              : 'bg-paper text-body border-line-strong hover:bg-surface-hover'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {errors.paymentPreference && (
                  <p className="text-xs text-danger font-medium">{errors.paymentPreference}</p>
                )}

                {/* Live-calculated payment breakdown - only shown once the customer has actually made a choice */}
                {selectedProduct && hasChosenPayment && (
                  <div className="pt-3 border-t border-line space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-body">
                      <span>Total Harga</span>
                      <span className="font-semibold text-ink">{formatIDR(totalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-body">
                      <span>
                        {formData.paymentPreference === 'DP'
                          ? `DP (${formData.paymentPreferencePercentage}%) — Dibayar Sekarang`
                          : 'Dibayar Sekarang (Lunas)'}
                      </span>
                      <span className="font-bold text-danger">{formatIDR(dpAmount)}</span>
                    </div>
                    {formData.paymentPreference === 'DP' && (
                      <div className="flex items-center justify-between text-body">
                        <span>Sisa Pembayaran (Pelunasan)</span>
                        <span className="font-semibold text-ink">{formatIDR(remainingAfterDp)}</span>
                      </div>
                    )}
                  </div>
                )}

                {studioProfile?.bankAccountNumber && selectedProduct && hasChosenPayment && (
                  <div className="pt-3 border-t border-line text-xs">
                    <span className="text-muted block mb-1">
                      Transfer {formatIDR(dpAmount)} ke Rekening Berikut
                    </span>
                    <p className="font-bold text-ink">
                      {studioProfile.bankName} — {studioProfile.bankAccountNumber}
                    </p>
                    <p className="text-body">a.n. {studioProfile.bankAccountHolder}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-paper border border-line text-xs text-body space-y-1">
                <p className="font-bold text-ink">Alur Setelah Submit:</p>
                <p>1. Order ID dan invoice akan langsung dibuat otomatis oleh sistem.</p>
                <p>2. Tim desainer kami memvalidasi file dan menyusun digital approval mockup.</p>
                <p>3. Anda dapat langsung menghubungkan chat dengan WhatsApp admin untuk koordinasi cepat beserta konfirmasi pembayaran.</p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mt-5 p-3 bg-danger/10 border border-danger/30 rounded-xs text-xs text-danger">
              {submitError}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 pt-5 border-t border-line flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="py-3 px-5 border border-line-strong bg-paper hover:bg-surface-hover text-ink text-xs font-semibold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="py-3 px-6 bg-accent hover:bg-accent-soft text-on-accent text-xs font-semibold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-transform active:scale-98 shadow-xs"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="submit-custom-order-btn"
                type="submit"
                disabled={isSubmitting}
                className="py-3.5 px-8 bg-accent hover:bg-accent-soft text-on-accent text-xs font-semibold uppercase tracking-widest rounded-xs flex items-center gap-2 transition-transform active:scale-98 shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-ink-soft" />
                    <span>Mengirim Pesanan...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Pesanan Custom</span>
                    <CheckCircle2 className="w-4 h-4 text-sage-soft" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
