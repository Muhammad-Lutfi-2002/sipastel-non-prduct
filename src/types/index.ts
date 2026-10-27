export type CategoryType = 'ALL' | 'KAOS' | 'JERSEY' | 'CUSTOM' | 'BEST SELLER' | 'NEW';

export interface ProductVariant {
  color: string;
  colorHex: string;
  images: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: 'KAOS' | 'JERSEY' | 'CUSTOM';
  isBestSeller?: boolean;
  isNew?: boolean;
  price: number;
  formattedPrice: string;
  shortDescription: string;
  description: string;
  material: string;
  fit: string;
  productionTime: string;
  careInstructions: string[];
  sizes: string[];
  colors: {
    name: string;
    hex: string;
  }[];
  images: string[];
  inStock: boolean;
}

export interface CartItem {
  id: string; // generated unique cart item id (product id + size + color)
  productId: string;
  productName: string;
  category: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  image: string;
}

export type PaymentStatus = 'BELUM_BAYAR' | 'DP_DIBAYAR' | 'LUNAS';
export type PaymentType = 'DP' | 'PELUNASAN' | 'LAINNYA';
export type PaymentLedgerStatus = 'VALID' | 'VOID';

export interface Payment {
  paymentId: string;
  orderId: string; // internal UUID (orders.id), not the human-readable order_id
  invoiceId: string;
  paidAt: string;
  amount: number;
  paymentType: PaymentType;
  paymentMethod: string;
  note?: string;
  status: PaymentLedgerStatus;
  recordedBy?: string;
  recordedByName?: string;
  isOverpaymentOverride: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidedByName?: string;
  voidReason?: string;
  createdAt: string;
}

export type ProductionStatus =
  | 'WAITING_VALIDATION'
  | 'PRODUCTION_QUEUE'
  | 'DESIGN'
  | 'DESIGN_APPROVAL'
  | 'DESIGN_REVISION'
  | 'DESIGN_APPROVED'
  | 'CUTTING'
  | 'SEWING'
  | 'PRINTING'
  | 'QC'
  | 'REWORK'
  | 'PACKING'
  | 'READY_TO_SHIP';

export type ShippingStatus =
  | 'NOT_SHIPPED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED';

export interface OrderItem {
  productId?: string;
  productName: string;
  category?: string;
  variantColor?: string;
  size?: string;
  quantity: number;
  price?: number;
  image?: string;
}

export type AdminRole = 'OWNER' | 'ADMIN' | 'FINANCE' | 'PRODUCTION_HEAD' | 'MARKETING' | 'INVESTOR';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar?: string;
  lastLogin?: string;
}

export interface ProductionLog {
  id: string;
  timestamp: string;
  previousStatus?: ProductionStatus;
  newStatus: ProductionStatus;
  note?: string;
  authorName?: string;
}

export interface AdminNotification {
  id: string;
  message: string;
  category: 'ORDER' | 'PAYMENT' | 'DESIGN' | 'PRODUCTION' | 'QC' | 'SHIPPING';
  orderId?: string;
  createdAt: string;
  isRead: boolean;
}

export interface Order {
  id: string; // internal UUID (orders.id) - the stable identity used by payments/invoices
  orderId: string; // human-readable business ID, e.g. SPS-20260905-182
  invoiceId?: string;
  customer: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  postalCode: string;
  items: OrderItem[];
  quantity: number;
  totalPrice?: number;
  totalPaid: number;
  remainingBalance: number;
  paymentPercentage: number;
  design?: string | null;
  designFileName?: string | null;
  notes?: string;
  request?: string;
  productType?: string;
  material?: string;
  sizeSpec?: string;
  colorSpec?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDate?: string;
  // Customer's stated payment intent from the order form (DP vs full
  // payment, and target %). Purely informational for the admin to see
  // before quoting a price - NOT the actual confirmed payment, which is
  // always derived from the payments ledger via paymentPercentage/
  // paymentStatus/totalPaid/remainingBalance above.
  paymentPreference?: 'DP' | 'LUNAS';
  paymentPreferencePercentage?: number;
  productionStatus: ProductionStatus;
  shippingStatus: ShippingStatus;
  courier?: string;
  trackingNumber?: string;
  responsibleTeam?: string;
  timelineLogs?: ProductionLog[];
  invoiceNumber: string;
  createdAt: string;
  isCustomOrder: boolean;
}

export interface CustomOrderFormData {
  customerName: string;
  whatsappNumber: string;
  email: string;
  productType: 'Kaos' | 'Jersey' | 'Custom Apparel Lainnya';
  quantity: number;
  size: string;
  color: string;
  materialVariant: string;
  designFile: File | null;
  designPreviewUrl: string | null;
  designDescription: string;
  additionalNotes: string;
  referenceUrl: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  paymentPreference: 'DP' | 'LUNAS' | null; // null = customer hasn't chosen yet (must pick before submitting)
  paymentPreferencePercentage: number | null; // meaningful only when paymentPreference === 'DP'; null = not chosen yet
  selectedProductId: string | null; // catalog product chosen in Step 2, drives live pricing
}
