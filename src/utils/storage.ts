import { CartItem, Order, Payment, Product, ProductionLog } from '../types';
import { supabase } from '../lib/supabaseClient';
import { friendlyDbError, toMutationResult, MutationResult } from '../lib/dbErrors';
import { formatIDR } from './formatters';
import { phoneLookupVariants } from './phone';
import { validateUpload } from './upload';

export type { MutationResult } from '../lib/dbErrors';

const CART_STORAGE_KEY = 'sipastel_cart_items_v1';

// Bucket name for customer-uploaded custom order design files (mockups,
// reference images, vector previews). Must exist in the Supabase
// Dashboard (Storage -> New bucket) and be set to Public, so the URL saved
// on the order row can be rendered directly in the admin panel without a
// signed-URL round-trip.
const DESIGN_BUCKET = 'design-uploads';

// Max size we accept for a design upload, checked client-side first to
// fail fast without waiting on a network round trip for an obviously
// oversized attachment.
export const MAX_DESIGN_FILE_BYTES = 3 * 1024 * 1024; // 3MB

// Small helper: a random path segment so two uploads in the same millisecond
// never collide, and file names never come from user input.
function randomSegment(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Uploads a customer's custom-order design file to Supabase Storage.
// The file's real type is verified from its bytes (not its name), and the
// stored object name is generated - the customer's original file name is
// kept separately in orders.design_file_name for display only.
//
// NOTE: A Cloudflare R2-backed version (via the Worker API in worker/ and
// src/utils/imageUpload.ts) exists but is intentionally disabled; see
// wrangler.jsonc for how to switch back.
export async function uploadDesignFile(
  file: File,
  orderId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const checked = await validateUpload(file, {
    allowed: ['png', 'jpeg', 'pdf', 'psd'],
    maxBytes: MAX_DESIGN_FILE_BYTES,
  });
  if (!checked.ok) {
    return { success: false, error: checked.error };
  }

  try {
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `${safeOrderId}/${Date.now()}-${randomSegment()}.${checked.ext}`;

    const { error: uploadError } = await supabase.storage.from(DESIGN_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      // Browsers often report PSD as "" - send the detected type instead.
      ...(file.type ? {} : { contentType: checked.contentType }),
    });

    if (uploadError) {
      console.error('Failed to upload design file to Supabase Storage:', uploadError.message);
      return { success: false, error: 'Gagal mengunggah file desain. Coba lagi.' };
    }

    const { data } = supabase.storage.from(DESIGN_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      return { success: false, error: 'Gagal mendapatkan URL file desain.' };
    }
    return { success: true, url: data.publicUrl };
  } catch (e) {
    console.error('Unexpected error uploading design file:', e);
    return { success: false, error: 'Terjadi kesalahan tak terduga saat mengunggah file.' };
  }
}

// Cart is intentionally kept in localStorage rather than Supabase: it's
// per-device "in progress" state for an anonymous shopper before an order
// even exists, so there is no meaningful server-side record to sync yet.
export function getStoredCart(): CartItem[] {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load cart from storage:', e);
    return [];
  }
}

export function saveStoredCart(cart: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart to storage:', e);
  }
}

// ---------- Orders (Supabase-backed) ----------

// Maps a `public.orders` database row (snake_case) to the app's Order type
// (camelCase). Keeping this mapping in one place means the rest of the app
// never has to know about the database's column naming.
function rowToOrder(row: Record<string, unknown>): Order {
  const invoiceRel = row.invoices as { id: string }[] | { id: string } | null | undefined;
  const invoiceId = Array.isArray(invoiceRel) ? invoiceRel[0]?.id : invoiceRel?.id;

  return {
    id: row.id as string,
    orderId: row.order_id as string,
    invoiceId: invoiceId ?? undefined,
    customer: row.customer as string,
    phone: row.phone as string,
    email: (row.email as string) ?? undefined,
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    postalCode: (row.postal_code as string) ?? '',
    items: (row.items as Order['items']) ?? [],
    quantity: row.quantity as number,
    totalPrice: row.total_price != null ? Number(row.total_price) : undefined,
    totalPaid: row.total_paid != null ? Number(row.total_paid) : 0,
    remainingBalance: row.remaining_balance != null ? Number(row.remaining_balance) : 0,
    paymentPercentage: row.payment_percentage != null ? Number(row.payment_percentage) : 0,
    design: (row.design_url as string) ?? null,
    designFileName: (row.design_file_name as string) ?? null,
    notes: (row.notes as string) ?? undefined,
    request: (row.request as string) ?? undefined,
    productType: (row.product_type as string) ?? undefined,
    material: (row.material as string) ?? undefined,
    sizeSpec: (row.size_spec as string) ?? undefined,
    colorSpec: (row.color_spec as string) ?? undefined,
    paymentStatus: row.payment_status as Order['paymentStatus'],
    paymentMethod: (row.payment_method as string) ?? undefined,
    paymentDate: (row.payment_date as string) ?? undefined,
    paymentPreference: (row.payment_preference as Order['paymentPreference']) ?? undefined,
    paymentPreferencePercentage:
      row.payment_preference_percentage != null ? Number(row.payment_preference_percentage) : undefined,
    productionStatus: row.production_status as Order['productionStatus'],
    shippingStatus: row.shipping_status as Order['shippingStatus'],
    courier: (row.courier as string) ?? undefined,
    trackingNumber: (row.tracking_number as string) ?? undefined,
    responsibleTeam: (row.responsible_team as string) ?? undefined,
    invoiceNumber: row.invoice_number as string,
    createdAt: row.created_at as string,
    isCustomOrder: row.is_custom_order as boolean,
  };
}

// Maps an app Order back to database column names for insert/update.
function orderToRow(order: Order): Record<string, unknown> {
  return {
    order_id: order.orderId,
    invoice_number: order.invoiceNumber,
    customer: order.customer,
    phone: order.phone,
    email: order.email ?? null,
    address: order.address ?? null,
    city: order.city ?? null,
    postal_code: order.postalCode ?? null,
    is_custom_order: order.isCustomOrder,
    product_type: order.productType ?? null,
    items: order.items ?? [],
    quantity: order.quantity,
    design_url: order.design ?? null,
    design_file_name: order.designFileName ?? null,
    notes: order.notes ?? null,
    request: order.request ?? null,
    material: order.material ?? null,
    size_spec: order.sizeSpec ?? null,
    color_spec: order.colorSpec ?? null,
    total_price: order.totalPrice ?? 0,
    // payment_status / total_paid / remaining_balance / payment_percentage are
    // intentionally NOT sent here - they are computed and locked server-side
    // (see the orders_force_default_payment_state and payments_after_change
    // triggers). The payment ledger (`payments` table) is the only way to
    // change an order's paid amount.
    payment_preference: order.paymentPreference ?? null,
    payment_preference_percentage: order.paymentPreferencePercentage ?? null,
    production_status: order.productionStatus,
    shipping_status: order.shippingStatus,
    courier: order.courier ?? null,
    tracking_number: order.trackingNumber ?? null,
    responsible_team: order.responsibleTeam ?? null,
  };
}

// Upper bound on rows pulled into the admin console in one go. The console
// filters/aggregates client-side, so an unbounded query would grow without
// limit as the business does; when the cap is hit the UI tells the admin.
export const ORDER_FETCH_LIMIT = 2000;

export interface OrdersFetchResult {
  data: Order[];
  /** null when the request succeeded. */
  error: string | null;
  /** true when more rows exist than ORDER_FETCH_LIMIT. */
  truncated: boolean;
}

// Error-aware read used by the admin views: an empty list caused by a
// failed request must look different from a genuinely empty business.
export async function fetchOrders(): Promise<OrdersFetchResult> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, invoices(id)')
    .order('created_at', { ascending: false })
    .limit(ORDER_FETCH_LIMIT);
  if (error) {
    console.error('Failed to load orders from Supabase:', error.message);
    return { data: [], error: friendlyDbError(error), truncated: false };
  }
  const rows = data ?? [];
  return { data: rows.map(rowToOrder), error: null, truncated: rows.length >= ORDER_FETCH_LIMIT };
}

// Loads a single order by its human-readable ID (used by the detail page so
// it does not have to download every order just to show one).
export async function fetchOrderByOrderId(
  orderId: string
): Promise<{ data: Order | null; error: string | null }> {
  const byBusinessId = await supabase
    .from('orders')
    .select('*, invoices(id)')
    .eq('order_id', orderId)
    .maybeSingle();
  if (byBusinessId.error) {
    console.error('Failed to load order from Supabase:', byBusinessId.error.message);
    return { data: null, error: friendlyDbError(byBusinessId.error) };
  }
  if (byBusinessId.data) return { data: rowToOrder(byBusinessId.data), error: null };

  // Links (e.g. notifications) may carry the internal UUID instead of the
  // human-readable ID; accept both.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    const byUuid = await supabase.from('orders').select('*, invoices(id)').eq('id', orderId).maybeSingle();
    if (byUuid.error) return { data: null, error: friendlyDbError(byUuid.error) };
    return { data: byUuid.data ? rowToOrder(byUuid.data) : null, error: null };
  }
  return { data: null, error: null };
}

// Convenience wrapper for callers that only need the rows (search, etc.).
export async function getStoredOrders(): Promise<Order[]> {
  return (await fetchOrders()).data;
}

// Public, self-service order lookup for customers. Deliberately requires
// BOTH the order_id and the phone number used at checkout (calls the
// `track_order` database function, which enforces this match server-side)
// so a customer can only ever look up their own order, never browse others.
//
// Phone numbers are stored exactly as customers typed them ("0812-...",
// "+62 812...", ...), so the lookup tries the common spellings of the same
// number instead of demanding an identical string.
export async function trackOrder(orderId: string, phone: string): Promise<Order | null> {
  const id = orderId.trim();
  if (!id) return null;

  for (const variant of phoneLookupVariants(phone)) {
    const { data, error } = await supabase.rpc('track_order', {
      p_order_id: id,
      p_phone: variant,
    });
    if (error) {
      console.error('track_order failed:', error.message);
      return null;
    }
    if (data && data.length > 0) return rowToOrder(data[0]);
  }
  return null;
}

export async function addStoredOrder(order: Order): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('orders').insert(orderToRow(order));
  if (error) {
    console.error('Failed to insert order into Supabase:', error.message);
    return { success: false, error: friendlyDbError(error) };
  }
  return { success: true };
}

// Sets the production/shipping status of one order (used by the production
// board and dashboard shortcuts). payment_status is intentionally never
// settable here - it is derived from the payments ledger and the database
// rejects direct writes to it.
export async function updateStoredOrderStatus(
  orderId: string,
  productionStatus?: Order['productionStatus'],
  shippingStatus?: Order['shippingStatus']
): Promise<MutationResult> {
  const patch: Record<string, unknown> = {};
  if (productionStatus) patch.production_status = productionStatus;
  if (shippingStatus) patch.shipping_status = shippingStatus;
  if (Object.keys(patch).length === 0) return { success: true };

  const response = await supabase.from('orders').update(patch).eq('order_id', orderId).select('id');
  const result = toMutationResult(response);
  if (!result.success) console.error('Failed to update order status:', response.error?.message ?? 'no rows affected');
  return result;
}

// ---------- Products / Catalog (Supabase-backed) ----------

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    category: row.category as Product['category'],
    isBestSeller: Boolean(row.is_best_seller),
    isNew: Boolean(row.is_new),
    price: Number(row.price),
    formattedPrice: formatIDR(Number(row.price)),
    shortDescription: (row.short_description as string) ?? '',
    description: (row.description as string) ?? '',
    material: (row.material as string) ?? '',
    fit: (row.fit as string) ?? '',
    productionTime: (row.production_time as string) ?? '',
    careInstructions: (row.care_instructions as string[]) ?? [],
    sizes: (row.sizes as string[]) ?? [],
    colors: (row.colors as Product['colors']) ?? [],
    images: (row.images as string[]) ?? [],
    inStock: Boolean(row.in_stock),
  };
}

export async function fetchProducts(): Promise<{ data: Product[]; error: string | null }> {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('Failed to load products from Supabase:', error.message);
    return { data: [], error: friendlyDbError(error) };
  }
  return { data: (data ?? []).map(rowToProduct), error: null };
}

export async function getStoredProducts(): Promise<Product[]> {
  return (await fetchProducts()).data;
}

export async function toggleProductStock(productId: string, inStock: boolean): Promise<MutationResult> {
  const response = await supabase.from('products').update({ in_stock: inStock }).eq('id', productId).select('id');
  return toMutationResult(response);
}

export async function deleteStoredProduct(productId: string): Promise<MutationResult> {
  const response = await supabase.from('products').delete().eq('id', productId).select('id');
  return toMutationResult(response);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'produk'
  );
}

export interface ProductInput {
  name: string;
  category: Product['category'];
  price: number;
  shortDescription?: string;
  material?: string;
  sizes?: string[];
  /** Convenience for the single cover image; ignored when `images` is given. */
  imageUrl?: string;
  /** Full ordered image list. Use this on edit so extra gallery images are preserved. */
  images?: string[];
  inStock?: boolean;
}

export const MAX_PRODUCT_PRICE = 1_000_000_000;

// Admin-only (enforced by the "Owner and Production Head manage products"
// RLS policy on the products table - anon/customer sessions can only
// SELECT). Generates an id/slug consistent with the studio's existing
// "prod-xxxx" seed data.
export async function createStoredProduct(
  input: ProductInput
): Promise<{ success: boolean; error?: string; product?: Product }> {
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > MAX_PRODUCT_PRICE) {
    return { success: false, error: 'Harga produk harus berupa angka lebih dari 0.' };
  }
  const suffix = `${Date.now().toString(36)}${randomSegment().slice(0, 4)}`;
  const id = `prod-${suffix}`;
  const slug = `${slugify(input.name)}-${suffix.slice(-4)}`;
  const images = input.images ?? (input.imageUrl ? [input.imageUrl] : []);

  const { data, error } = await supabase
    .from('products')
    .insert({
      id,
      slug,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      short_description: input.shortDescription ?? '',
      material: input.material ?? '',
      sizes: input.sizes ?? [],
      images,
      in_stock: input.inStock ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create product in Supabase:', error.message);
    return { success: false, error: friendlyDbError(error) };
  }
  return { success: true, product: rowToProduct(data) };
}

// Partial update - only the fields the admin actually changed are sent.
export async function updateStoredProduct(
  productId: string,
  updates: Partial<ProductInput>
): Promise<MutationResult> {
  if (updates.price !== undefined && (!Number.isFinite(updates.price) || updates.price <= 0 || updates.price > MAX_PRODUCT_PRICE)) {
    return { success: false, error: 'Harga produk harus berupa angka lebih dari 0.' };
  }

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.shortDescription !== undefined) payload.short_description = updates.shortDescription;
  if (updates.material !== undefined) payload.material = updates.material;
  if (updates.sizes !== undefined) payload.sizes = updates.sizes;
  if (updates.images !== undefined) payload.images = updates.images;
  else if (updates.imageUrl !== undefined) payload.images = updates.imageUrl ? [updates.imageUrl] : [];
  if (updates.inStock !== undefined) payload.in_stock = updates.inStock;

  if (Object.keys(payload).length === 0) return { success: true };

  const response = await supabase.from('products').update(payload).eq('id', productId).select('id');
  return toMutationResult(response);
}

// --- Product Image Upload (Storage) ---
// Separate bucket from design uploads/branding assets, admin-only write
// via RLS (see product_images_* policies), public read so the resulting
// URL renders directly in <img> on both the admin panel and the customer
// catalog. This is an ALTERNATIVE to pasting an image URL directly.
const PRODUCT_IMAGE_BUCKET = 'product-images';
const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB, matches the bucket's own file_size_limit

export async function uploadProductImage(
  file: File
): Promise<{ success: boolean; error?: string; url?: string; path?: string }> {
  const checked = await validateUpload(file, {
    allowed: ['png', 'jpeg', 'webp'],
    maxBytes: MAX_PRODUCT_IMAGE_BYTES,
  });
  if (!checked.ok) return { success: false, error: checked.error };

  try {
    const path = `product-${Date.now()}-${randomSegment()}.${checked.ext}`;

    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      console.error('Failed to upload product image:', uploadError.message);
      return { success: false, error: 'Upload gambar gagal. Coba lagi.' };
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      return { success: false, error: 'Gagal mendapatkan URL publik gambar.' };
    }
    return { success: true, url: data.publicUrl, path };
  } catch (e) {
    console.error('Unexpected error uploading product image:', e);
    return { success: false, error: 'Terjadi kesalahan tak terduga saat upload gambar.' };
  }
}

// Extracts the object path from a public URL of one of OUR buckets, or null
// for anything else (external URLs are never ours to delete).
export function ownedObjectPath(imageUrl: string | null | undefined, bucket: string): string | null {
  if (!imageUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = imageUrl.slice(idx + marker.length).split('?')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// Best-effort cleanup - only deletes if the URL actually points at our own
// product-images bucket (a manually-pasted external URL is left alone).
export async function deleteProductImageIfOwned(imageUrl: string | null | undefined): Promise<void> {
  const path = ownedObjectPath(imageUrl, PRODUCT_IMAGE_BUCKET);
  if (!path) return;
  try {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  } catch (e) {
    console.error('Failed to clean up product image:', e);
  }
}

// Sets/updates the admin-quoted price for a custom order. Custom orders can
// be created with total_price = 0 (not quoted yet); the
// `trg_recalc_on_price_change` trigger recomputes total_paid /
// remaining_balance / payment_percentage / payment_status afterwards, so
// those never need to be touched here.
export async function updateOrderPrice(orderId: string, totalPrice: number): Promise<MutationResult> {
  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    return { success: false, error: 'Harga harus berupa angka dan tidak boleh negatif.' };
  }
  if (totalPrice > MAX_PRODUCT_PRICE * 10) {
    return { success: false, error: 'Nominal harga terlalu besar. Periksa kembali angkanya.' };
  }
  const response = await supabase
    .from('orders')
    .update({ total_price: Math.round(totalPrice) })
    .eq('order_id', orderId)
    .select('id');
  return toMutationResult(response);
}

// Updates production/shipping status plus courier & tracking in one write.
// Status transitions are also captured by the database trigger in
// order_status_history; courier/tracking are plain column updates.
export async function updateOrderDetails(
  orderId: string,
  patch: {
    productionStatus?: Order['productionStatus'];
    shippingStatus?: Order['shippingStatus'];
    courier?: string;
    trackingNumber?: string;
  }
): Promise<MutationResult> {
  const row: Record<string, unknown> = {};
  if (patch.productionStatus) row.production_status = patch.productionStatus;
  if (patch.shippingStatus) row.shipping_status = patch.shippingStatus;
  if (patch.courier !== undefined) row.courier = patch.courier.trim() || null;
  if (patch.trackingNumber !== undefined) row.tracking_number = patch.trackingNumber.trim() || null;
  if (Object.keys(row).length === 0) return { success: true };

  const response = await supabase.from('orders').update(row).eq('order_id', orderId).select('id');
  return toMutationResult(response);
}

// ---------- Order activity log (staff notes + status changes) ----------
// Persistent, per-order timeline shown on the order detail screen. Backed by
// the `order_activity_log` table (see supabase/migrations). Reads/writes
// degrade gracefully when the table has not been created yet.

function rowToActivity(row: Record<string, unknown>): ProductionLog {
  const author = row.author as { name: string } | null | undefined;
  return {
    id: row.id as string,
    timestamp: row.created_at as string,
    previousStatus: (row.previous_status as ProductionLog['previousStatus']) ?? undefined,
    newStatus: row.new_status as ProductionLog['newStatus'],
    note: (row.note as string) ?? undefined,
    authorName: author?.name ?? undefined,
  };
}

export async function getOrderActivity(orderInternalId: string): Promise<ProductionLog[]> {
  const { data, error } = await supabase
    .from('order_activity_log')
    .select('*, author:staff_profiles!order_activity_log_author_id_fkey(name)')
    .eq('order_id', orderInternalId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Failed to load order activity:', error.message);
    return [];
  }
  return (data ?? []).map(rowToActivity);
}

export async function addOrderActivity(entry: {
  orderInternalId: string;
  previousStatus?: Order['productionStatus'];
  newStatus: Order['productionStatus'];
  note?: string;
}): Promise<MutationResult> {
  // author_id defaults to auth.uid() in the database, so the author cannot be spoofed from here.
  const { error } = await supabase.from('order_activity_log').insert({
    order_id: entry.orderInternalId,
    previous_status: entry.previousStatus ?? null,
    new_status: entry.newStatus,
    note: entry.note?.trim() || null,
  });
  if (error) {
    console.error('Failed to write order activity:', error.message);
    return { success: false, error: friendlyDbError(error) };
  }
  return { success: true };
}

// ---------- Payments (Supabase-backed, append-only ledger) ----------

function rowToPayment(row: Record<string, unknown>): Payment {
  const recorder = row.recorder as { name: string } | null | undefined;
  const voider = row.voider as { name: string } | null | undefined;
  return {
    paymentId: row.payment_id as string,
    orderId: row.order_id as string,
    invoiceId: row.invoice_id as string,
    paidAt: row.paid_at as string,
    amount: Number(row.amount),
    paymentType: row.payment_type as Payment['paymentType'],
    paymentMethod: row.payment_method as string,
    note: (row.note as string) ?? undefined,
    status: row.status as Payment['status'],
    recordedBy: (row.recorded_by as string) ?? undefined,
    recordedByName: recorder?.name,
    isOverpaymentOverride: Boolean(row.is_overpayment_override),
    voidedAt: (row.voided_at as string) ?? undefined,
    voidedBy: (row.voided_by as string) ?? undefined,
    voidedByName: voider?.name,
    voidReason: (row.void_reason as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// Full payment history for one order, newest first. Includes voided entries
// (shown, never hidden) so Admin can see the complete trail.
export async function fetchPaymentHistory(
  orderInternalId: string
): Promise<{ data: Payment[]; error: string | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, recorder:staff_profiles!payments_recorded_by_fkey(name), voider:staff_profiles!payments_voided_by_fkey(name)')
    .eq('order_id', orderInternalId)
    .order('paid_at', { ascending: false });

  if (error) {
    console.error('Failed to load payment history from Supabase:', error.message);
    return { data: [], error: friendlyDbError(error) };
  }
  return { data: (data ?? []).map(rowToPayment), error: null };
}

export async function getPaymentHistory(orderInternalId: string): Promise<Payment[]> {
  return (await fetchPaymentHistory(orderInternalId)).data;
}

// Valid (non-void) payments since a date, used for the revenue chart so
// income is attributed to the day the money actually arrived - not to the
// day the order happened to be created.
export async function fetchValidPaymentsSince(
  sinceIso: string
): Promise<{ data: { paidAt: string; amount: number }[]; error: string | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('paid_at, amount')
    .eq('status', 'VALID')
    .gte('paid_at', sinceIso)
    .order('paid_at', { ascending: true })
    .limit(5000);
  if (error) {
    console.error('Failed to load payments from Supabase:', error.message);
    return { data: [], error: friendlyDbError(error) };
  }
  return {
    data: (data ?? []).map((r: { paid_at: string; amount: number | string }) => ({
      paidAt: r.paid_at,
      amount: Number(r.amount),
    })),
    error: null,
  };
}

export interface RecordPaymentInput {
  orderInternalId: string;
  invoiceId: string;
  amount: number;
  paymentType: Payment['paymentType'];
  paymentMethod: string;
  note?: string;
  recordedBy: string;
  isOverpaymentOverride?: boolean;
  paidAt?: string;
}

// Records a new payment transaction. This is the ONLY way total_paid /
// remaining_balance / payment_percentage / payment_status on the parent
// order can change - the database trigger recalculates them automatically
// from the full ledger the moment this insert succeeds. The business rule
// (amount cannot exceed the remaining balance, unless explicitly overridden
// by an Owner) is enforced server-side and cannot be bypassed from here.
export async function recordPayment(
  input: RecordPaymentInput
): Promise<{ success: boolean; error?: string; payment?: Payment }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Nominal pembayaran harus lebih besar dari 0.' };
  }
  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id: input.orderInternalId,
      invoice_id: input.invoiceId,
      amount: Math.round(input.amount),
      payment_type: input.paymentType,
      payment_method: input.paymentMethod,
      note: input.note ?? null,
      recorded_by: input.recordedBy,
      is_overpayment_override: input.isOverpaymentOverride ?? false,
      ...(input.paidAt ? { paid_at: input.paidAt } : {}),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record payment in Supabase:', error.message);
    return { success: false, error: friendlyDbError(error) };
  }
  return { success: true, payment: rowToPayment(data) };
}

// Voids/reverses a payment. The original row is preserved exactly as-is;
// only the void metadata columns are filled in (see the
// protect_payment_immutability trigger). Restricted to Owner by RLS.
export async function voidPayment(paymentId: string, voidedBy: string, reason: string): Promise<MutationResult> {
  const response = await supabase
    .from('payments')
    .update({
      status: 'VOID',
      voided_at: new Date().toISOString(),
      voided_by: voidedBy,
      void_reason: reason,
    })
    .eq('payment_id', paymentId)
    .select('payment_id');
  return toMutationResult(response, {
    notFoundMessage: 'Pembayaran tidak dapat dibatalkan: hanya Owner yang boleh membatalkan pembayaran.',
  });
}

// ---------- Studio profile settings (Supabase-backed) ----------

export interface StudioProfile {
  name: string;
  address: string;
  phone: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  logoUrl: string | null;
}

// Display-only fallback for when the profile cannot be loaded. Deliberately
// contains no invented phone/bank details: anything shown to customers or
// printed on invoices must come from the real settings.
export const FALLBACK_STUDIO_PROFILE: StudioProfile = {
  name: 'SIPASTEL APPAREL STUDIO',
  address: '',
  phone: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  logoUrl: null,
};

export async function fetchStudioProfile(): Promise<{ data: StudioProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('studio_profile')
    .select('name, address, phone, bank_name, bank_account_number, bank_account_holder, logo_url')
    .eq('id', true)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load studio profile from Supabase:', error?.message);
    return { data: null, error: error ? friendlyDbError(error) : 'Profil studio belum dibuat di database.' };
  }
  return {
    data: {
      name: data.name,
      address: data.address ?? '',
      phone: data.phone ?? '',
      bankName: data.bank_name ?? '',
      bankAccountNumber: data.bank_account_number ?? '',
      bankAccountHolder: data.bank_account_holder ?? '',
      logoUrl: data.logo_url ?? null,
    },
    error: null,
  };
}

// For read-only display (logo in headers, bank info for customers): falls
// back to a neutral profile rather than failing the whole page.
export async function getStoredStudioProfile(): Promise<StudioProfile> {
  const { data } = await fetchStudioProfile();
  return data ?? FALLBACK_STUDIO_PROFILE;
}

// Saves the editable text fields. The logo is intentionally NOT part of
// this write (see setStudioLogoUrl) so saving the form can never overwrite
// a logo that was changed in the meantime.
export async function saveStoredStudioProfile(
  profile: Omit<StudioProfile, 'logoUrl'>
): Promise<MutationResult> {
  const response = await supabase
    .from('studio_profile')
    .update({
      name: profile.name,
      address: profile.address,
      phone: profile.phone,
      bank_name: profile.bankName,
      bank_account_number: profile.bankAccountNumber,
      bank_account_holder: profile.bankAccountHolder,
    })
    .eq('id', true)
    .select('id');
  return toMutationResult(response, {
    notFoundMessage: 'Pengaturan tidak tersimpan. Hanya akun Owner yang dapat mengubah profil studio.',
  });
}

async function setStudioLogoUrl(logoUrl: string | null): Promise<MutationResult> {
  const response = await supabase.from('studio_profile').update({ logo_url: logoUrl }).eq('id', true).select('id');
  return toMutationResult(response, {
    notFoundMessage: 'Logo tidak tersimpan. Hanya akun Owner yang dapat mengubah logo studio.',
  });
}

// --- Studio Logo (Branding) ---
// Stored in the "branding-assets" bucket (public read, admin-only write via
// RLS). studio_profile.logo_url is the single source of truth for which
// logo is "active"; every header reads from there.
const LOGO_BUCKET = 'branding-assets';
const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024; // 2MB - a logo has no reason to be larger

async function removeOwnedLogoFile(url: string | null | undefined): Promise<void> {
  const path = ownedObjectPath(url, LOGO_BUCKET);
  if (!path) return;
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
  } catch (e) {
    console.error('Failed to remove logo file:', e);
  }
}

export async function uploadStudioLogo(
  file: File,
  previousLogoUrl?: string | null
): Promise<{ success: boolean; error?: string; url?: string }> {
  const checked = await validateUpload(file, {
    allowed: ['png', 'jpeg', 'webp', 'svg'],
    maxBytes: MAX_LOGO_FILE_BYTES,
  });
  if (!checked.ok) return { success: false, error: checked.error };

  try {
    // Unique path per upload (not a fixed "logo.png") so browsers/CDNs
    // never serve a stale cached logo after the admin replaces it.
    const path = `logo-${Date.now()}-${randomSegment().slice(0, 4)}.${checked.ext}`;

    const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      // Guarantee SVGs are served as images, whatever the browser reported.
      contentType: checked.contentType,
    });
    if (uploadError) {
      console.error('Failed to upload logo to Supabase Storage:', uploadError.message);
      return { success: false, error: 'Upload logo gagal. Pastikan Anda login sebagai Owner lalu coba lagi.' };
    }

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      await supabase.storage.from(LOGO_BUCKET).remove([path]);
      return { success: false, error: 'Gagal mendapatkan URL publik logo.' };
    }

    const saved = await setStudioLogoUrl(data.publicUrl);
    if (!saved.success) {
      // Don't leave an orphaned file behind when the reference was not saved.
      await supabase.storage.from(LOGO_BUCKET).remove([path]);
      return { success: false, error: saved.error };
    }

    // The new logo is live - now it is safe to drop the previous file.
    await removeOwnedLogoFile(previousLogoUrl);
    return { success: true, url: data.publicUrl };
  } catch (e) {
    console.error('Unexpected error uploading studio logo:', e);
    return { success: false, error: 'Terjadi kesalahan tak terduga saat upload logo.' };
  }
}

export async function removeStudioLogo(currentLogoUrl: string | null): Promise<MutationResult> {
  try {
    // Clear the reference FIRST. If it fails, the file is still there and the
    // logo keeps working; the reverse order could leave a logo_url pointing
    // at a deleted file.
    const saved = await setStudioLogoUrl(null);
    if (!saved.success) return saved;
    await removeOwnedLogoFile(currentLogoUrl);
    return { success: true };
  } catch (e) {
    console.error('Unexpected error removing studio logo:', e);
    return { success: false, error: 'Terjadi kesalahan tak terduga saat menghapus logo.' };
  }
}
