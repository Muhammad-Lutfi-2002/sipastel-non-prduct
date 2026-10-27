import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  ExternalLink,
  Pencil,
  Upload,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { Product } from '../../../types';
import {
  fetchProducts,
  MAX_PRODUCT_PRICE,
  toggleProductStock,
  deleteStoredProduct,
  createStoredProduct,
  updateStoredProduct,
  uploadProductImage,
  deleteProductImageIfOwned,
  ProductInput,
} from '../../../utils/storage';
import { formatIDR } from '../../../utils/formatters';
import { safeHttpUrl } from '../../../utils/safeUrl';
import { useAuth } from '../../../context/AuthContext';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { AdminTableSkeleton } from '../../Skeleton';
import { useAdminToast } from '../AdminToast';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { AdminButton, Badge, Card, EmptyState, PageHeader, cn, inputClass } from '../ui';

const EMPTY_FORM: ProductInput = {
  name: '',
  category: 'KAOS',
  price: 0,
  shortDescription: '',
  material: '',
  sizes: [],
  imageUrl: '',
  inStock: true,
};

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('products:write');

  const loadProducts = async () => {
    const res = await fetchProducts();
    if (res.error) {
      setLoadError(res.error);
    } else {
      setProducts(res.data);
      setLoadError(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useAdminToast();
  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => showToast(message, type);

  // Add / Edit product modal. `editingProduct` null + modal open = create
  // mode; non-null = editing that product's fields (including price).
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formValues, setFormValues] = useState<ProductInput>(EMPTY_FORM);
  const [sizesText, setSizesText] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Product image: upload from device OR paste a URL - both write to the
  // same formValues.imageUrl field, so whichever the admin used last wins.
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Image bookkeeping for the open form. Files uploaded while the form is
  // open are only "provisional": they are deleted again if the admin cancels
  // or swaps the image, and the ORIGINAL image of an edited product is only
  // deleted after the change has really been saved. (Previously the old
  // image was deleted the moment a new one was chosen, so cancelling the
  // form left the product pointing at a deleted file.)
  const sessionUploadsRef = useRef<string[]>([]);
  const originalImageRef = useRef<string>('');

  const discardSessionUploads = async (keep?: string) => {
    const toDelete = sessionUploadsRef.current.filter((u) => u !== keep);
    sessionUploadsRef.current = keep ? sessionUploadsRef.current.filter((u) => u === keep) : [];
    await Promise.all(toDelete.map((u) => deleteProductImageIfOwned(u)));
  };

  const closeForm = () => {
    if (isSavingProduct) return;
    void discardSessionUploads();
    setIsFormOpen(false);
  };

  useEscapeKey(isFormOpen && !isSavingProduct, closeForm);
  useEscapeKey(!!productToDelete && !isDeleting, () => setProductToDelete(null));
  useBodyScrollLock(isFormOpen || !!productToDelete);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormValues(EMPTY_FORM);
    setSizesText('');
    setFormErrors({});
    setImageUploadError(null);
    sessionUploadsRef.current = [];
    originalImageRef.current = '';
    setIsFormOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormValues({
      name: product.name,
      category: product.category,
      price: product.price,
      shortDescription: product.shortDescription,
      material: product.material,
      sizes: product.sizes ?? [],
      imageUrl: product.images?.[0] ?? '',
      inStock: product.inStock,
    });
    setSizesText((product.sizes ?? []).join(', '));
    setFormErrors({});
    setImageUploadError(null);
    sessionUploadsRef.current = [];
    originalImageRef.current = product.images?.[0] ?? '';
    setIsFormOpen(true);
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadError(null);
    setIsUploadingImage(true);

    const result = await uploadProductImage(file);
    setIsUploadingImage(false);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';

    if (!result.success || !result.url) {
      setImageUploadError(result.error || 'Upload gagal, silakan coba lagi.');
      return;
    }

    // Drop the previous provisional upload (never the original image).
    const replaced = sessionUploadsRef.current;
    sessionUploadsRef.current = [result.url];
    await Promise.all(replaced.map((u) => deleteProductImageIfOwned(u)));

    setFormValues((prev) => ({ ...prev, imageUrl: result.url! }));
  };

  const handleSaveProduct = async () => {
    if (isSavingProduct) return;

    const nextErrors: { [key: string]: string } = {};
    const name = formValues.name.trim();
    const price = Number(formValues.price);
    const imageUrl = (formValues.imageUrl ?? '').trim();

    if (!name) nextErrors.name = 'Nama produk wajib diisi.';
    else if (name.length > 120) nextErrors.name = 'Nama produk maksimal 120 karakter.';
    if (!price || price <= 0) nextErrors.price = 'Harga harus lebih dari Rp0.';
    else if (price > MAX_PRODUCT_PRICE) nextErrors.price = 'Harga terlalu besar. Periksa kembali angkanya.';
    if (imageUrl && !safeHttpUrl(imageUrl)) nextErrors.imageUrl = 'URL gambar harus diawali http:// atau https://.';
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSavingProduct(true);
    const sizes = sizesText.split(',').map((s) => s.trim()).filter(Boolean);
    const cleanValues: ProductInput = { ...formValues, name, price, imageUrl, sizes };

    if (editingProduct) {
      // Keep every other gallery image; only the cover (first) one is edited here.
      const rest = (editingProduct.images ?? []).slice(1);
      const images = imageUrl ? [imageUrl, ...rest] : rest;
      const result = await updateStoredProduct(editingProduct.id, { ...cleanValues, images });
      setIsSavingProduct(false);
      if (!result.success) {
        showFeedback(`Gagal menyimpan perubahan: ${result.error}`, 'error');
        return;
      }
      // Saved: now it is safe to delete the replaced original and any
      // provisional uploads that ended up unused.
      if (originalImageRef.current && originalImageRef.current !== imageUrl) {
        void deleteProductImageIfOwned(originalImageRef.current);
      }
      await discardSessionUploads(imageUrl);
      showFeedback(`Produk "${name}" berhasil diperbarui. Harga baru langsung tampil di form customer.`, 'success');
    } else {
      const result = await createStoredProduct(cleanValues);
      setIsSavingProduct(false);
      if (!result.success) {
        showFeedback(`Gagal menambah produk: ${result.error}`, 'error');
        return;
      }
      await discardSessionUploads(imageUrl);
      showFeedback(`Produk "${name}" berhasil ditambahkan ke katalog.`, 'success');
    }
    setIsFormOpen(false);
    void loadProducts();
  };

  const handleToggleStock = async (productId: string, currentInStock: boolean) => {
    if (!canWrite) return;
    // Optimistic update, reconciled with Supabase afterwards.
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, inStock: !currentInStock } : p)));
    const result = await toggleProductStock(productId, !currentInStock);
    if (!result.success) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, inStock: currentInStock } : p)));
      showFeedback(`Gagal memperbarui stok: ${result.error}`, 'error');
      return;
    }
    showFeedback('Status stok produk berhasil diperbarui.', 'success');
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete || isDeleting) return;
    setIsDeleting(true);
    const result = await deleteStoredProduct(productToDelete.id);
    setIsDeleting(false);
    if (!result.success) {
      showFeedback(`Gagal menghapus produk: ${result.error}`, 'error');
      setProductToDelete(null);
      return;
    }
    // Best-effort cleanup - only removes the file if it was uploaded via
    // this app's own product-images bucket, never touches external URLs.
    void deleteProductImageIfOwned(productToDelete.images?.[0]);
    setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
    setProductToDelete(null);
    showFeedback('Produk berhasil dihapus dari katalog.', 'success');
  };

  const q = searchQuery.toLowerCase().trim();
  const filteredProducts = products.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <PageHeader title="Katalog & Stok" />
        <AdminTableSkeleton rows={6} />
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Katalog & Stok"
        description="Katalog pakaian siap pakai, status stok, dan spesifikasi varian warna."
        actions={
          canWrite ? (
            <AdminButton variant="primary" onClick={openCreateModal}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tambah Produk</span>
            </AdminButton>
          ) : undefined
        }
      />

      {loadError && <LoadErrorBanner message={loadError} onRetry={() => void loadProducts()} hasStaleData={products.length > 0} />}
      {!canWrite && (
        <p role="note" className="text-xs text-muted bg-surface-hover border border-line rounded-lg p-2.5">
          Peran Anda hanya dapat melihat katalog. Perubahan produk dilakukan oleh Owner atau Kepala Produksi.
        </p>
      )}

      <div className="relative w-full sm:max-w-sm">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          aria-label="Cari produk"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nama produk, kategori..."
          className={cn(inputClass, 'pl-9 pr-8')}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-hover/50 text-muted text-xs">
                <th scope="col" className="py-2.5 px-4 font-medium">Produk</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Kategori</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Harga Jual</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Varian</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Status Stok</th>
                <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Package}
                      title="Tidak ada item katalog ditemukan."
                      description={products.length === 0 ? 'Produk yang ditambahkan akan tampil di sini.' : 'Coba ubah kata kunci pencarian.'}
                    />
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {prod.images?.[0] ? (
                          <img
                            src={prod.images[0]}
                            alt={prod.name}
                            loading="lazy"
                            className="w-10 h-10 rounded-lg object-cover border border-line bg-surface"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg border border-line bg-paper flex items-center justify-center"
                            aria-label="Belum ada gambar"
                          >
                            <ImageIcon className="w-4 h-4 text-muted" aria-hidden="true" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-ink">{prod.name}</p>
                          <span className="text-xs text-muted">
                            SKU: {prod.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-body">
                      {prod.category}
                    </td>

                    <td className="py-3 px-4 font-medium text-ink tabular-nums">
                      {formatIDR(prod.price)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(prod.colors || []).map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-paper border border-line text-[11px] text-body"
                          >
                            <span
                              className="w-2 h-2 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                            {c.name}
                          </span>
                        ))}
                        {(prod.sizes || []).length > 0 && (
                          <span className="text-[11px] font-mono text-muted">
                            ({prod.sizes.join(', ')})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStock(prod.id, prod.inStock)}
                          aria-label={`Ubah status stok ${prod.name}: saat ini ${prod.inStock ? 'tersedia' : 'stok habis'}`}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            prod.inStock
                              ? 'bg-sage/10 text-sage hover:bg-sage/20'
                              : 'bg-danger/10 text-danger hover:bg-danger/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${prod.inStock ? 'bg-sage' : 'bg-danger'}`} aria-hidden="true" />
                          <span>{prod.inStock ? 'Tersedia' : 'Stok Habis'}</span>
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                            prod.inStock ? 'bg-sage/10 text-sage' : 'bg-danger/10 text-danger'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${prod.inStock ? 'bg-sage' : 'bg-danger'}`} aria-hidden="true" />
                          <span>{prod.inStock ? 'Tersedia' : 'Stok Habis'}</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {canWrite ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(prod)}
                          className="p-1.5 text-muted hover:text-ink hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
                          title="Edit produk & harga"
                          aria-label={`Edit ${prod.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductToDelete(prod)}
                          className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors cursor-pointer"
                          title="Hapus produk"
                          aria-label={`Hapus ${prod.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Product Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl max-w-lg w-full border border-line shadow-xl animate-modal-content max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 sm:p-6 border-b border-line flex items-center justify-between">
              <h4 id="product-form-title" className="font-heading text-base font-semibold text-ink">
                {editingProduct ? `Edit Produk: ${editingProduct.name}` : 'Tambah Produk Baru'}
              </h4>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 -m-1 text-muted hover:text-ink cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label htmlFor="pf-name" className="block text-xs font-medium text-heading mb-1.5">
                  Nama Produk <span className="text-danger">*</span>
                </label>
                <input
                  id="pf-name"
                  maxLength={120}
                  type="text"
                  value={formValues.name}
                  onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                  placeholder="Contoh: Kaos DTF 24s Logo Only"
                  className={inputClass}
                />
                {formErrors.name && <p className="text-xs text-danger mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pf-category" className="block text-xs font-medium text-heading mb-1.5">Kategori</label>
                  <select
                    id="pf-category"
                    value={formValues.category}
                    onChange={(e) =>
                      setFormValues({ ...formValues, category: e.target.value as Product['category'] })
                    }
                    className={inputClass}
                  >
                    <option value="KAOS">KAOS</option>
                    <option value="JERSEY">JERSEY</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pf-price" className="block text-xs font-medium text-heading mb-1.5">
                    Harga / pcs (Rp) <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pf-price"
                    inputMode="numeric"
                    type="number"
                    min="0"
                    value={formValues.price || ''}
                    onChange={(e) =>
                      setFormValues({ ...formValues, price: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    placeholder="55000"
                    className={inputClass}
                  />
                  {formErrors.price && <p className="text-xs text-danger mt-1">{formErrors.price}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="pf-short" className="block text-xs font-medium text-heading mb-1.5">Deskripsi Singkat</label>
                <input
                  id="pf-short"
                  maxLength={200}
                  type="text"
                  value={formValues.shortDescription}
                  onChange={(e) => setFormValues({ ...formValues, shortDescription: e.target.value })}
                  placeholder="Contoh: Sablon DTF, 1 titik logo, tanpa nama/nomor punggung"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pf-material" className="block text-xs font-medium text-heading mb-1.5">Material</label>
                  <input
                    id="pf-material"
                    maxLength={100}
                    type="text"
                    value={formValues.material}
                    onChange={(e) => setFormValues({ ...formValues, material: e.target.value })}
                    placeholder="Combed 24s"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="pf-sizes" className="block text-xs font-medium text-heading mb-1.5">Ukuran / Varian</label>
                  <input
                    id="pf-sizes"
                    type="text"
                    value={sizesText}
                    onChange={(e) => setSizesText(e.target.value)}
                    placeholder="S, M, L, XL"
                    className={inputClass}
                  />
                  <p className="text-xs text-muted mt-1">Pisahkan tiap ukuran dengan koma.</p>
                </div>
              </div>

              {/* Gambar Produk: upload dari perangkat ATAU tempel URL - keduanya tetap tersedia */}
              <div>
                <span className="block text-xs font-medium text-heading mb-1.5">Gambar Produk</span>
                <div className="flex items-start gap-3">
                  <div className="w-20 h-20 shrink-0 rounded-lg border border-line bg-paper flex items-center justify-center overflow-hidden">
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 text-muted animate-spin" />
                    ) : formValues.imageUrl ? (
                      <img
                        src={formValues.imageUrl}
                        alt="Preview produk"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setImageUploadError('URL gambar tidak valid atau tidak bisa dimuat.')}
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileSelect}
                      disabled={isUploadingImage || isSavingProduct}
                      className="hidden"
                      id="product-image-upload-input"
                    />
                    <label
                      htmlFor="product-image-upload-input"
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-line-strong transition-colors ${
                        isUploadingImage
                          ? 'bg-surface-hover text-muted cursor-not-allowed'
                          : 'bg-surface hover:bg-surface-hover text-ink cursor-pointer'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Mengunggah...' : 'Upload dari Perangkat'}</span>
                    </label>
                    <p className="text-[11px] text-muted">PNG, JPG, atau WEBP. Maksimal 3MB.</p>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-line" />
                      <span className="text-[11px] text-muted">atau</span>
                      <div className="flex-1 h-px bg-line" />
                    </div>

                    <input
                      type="url"
                      aria-label="URL gambar produk"
                      value={formValues.imageUrl}
                      onChange={(e) => {
                        setImageUploadError(null);
                        setFormValues({ ...formValues, imageUrl: e.target.value });
                      }}
                      placeholder="Tempel URL gambar: https://..."
                      className={inputClass}
                    />

                    {formErrors.imageUrl && <p className="text-xs text-danger">{formErrors.imageUrl}</p>}
                    {imageUploadError && (
                      <p className="text-xs text-danger flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {imageUploadError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                <input
                  type="checkbox"
                  checked={formValues.inStock}
                  onChange={(e) => setFormValues({ ...formValues, inStock: e.target.checked })}
                  className="w-4 h-4 accent-accent"
                />
                Aktif &amp; tersedia di form pemesanan customer
              </label>
            </div>

            <div className="p-5 sm:p-6 pt-0 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="h-9 px-4 border border-line-strong bg-surface text-ink hover:bg-surface-hover text-sm font-medium rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={isSavingProduct || isUploadingImage}
                className="h-9 px-4 bg-accent hover:bg-accent-soft disabled:opacity-60 text-on-accent text-sm font-medium rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isSavingProduct ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => !isDeleting && setProductToDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface p-6 rounded-xl max-w-sm w-full border border-line shadow-xl space-y-4 animate-modal-content"
          >
            <h4 id="delete-product-title" className="font-heading text-base font-semibold text-ink">Hapus Produk</h4>
            <p className="text-sm text-body leading-relaxed">
              Anda yakin ingin menghapus <strong className="text-ink">{productToDelete.name}</strong> dari katalog studio?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="h-9 px-4 border border-line-strong bg-surface text-ink hover:bg-surface-hover text-sm font-medium rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={isDeleting}
                className="h-9 px-4 bg-danger hover:bg-danger/85 disabled:opacity-60 text-white text-sm font-medium rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
