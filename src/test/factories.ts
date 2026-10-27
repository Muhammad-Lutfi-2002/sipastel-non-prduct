import { Order, AdminUser } from '../types';

let counter = 0;

export function makeOrder(overrides: Partial<Order> = {}): Order {
  counter += 1;
  return {
    id: `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    orderId: `SPS-20260921-T${String(counter).padStart(5, '0')}`,
    customer: `Pelanggan ${counter}`,
    phone: '0812-3456-7890',
    email: undefined,
    address: 'Jl. Contoh No. 1',
    city: 'Bogor',
    postalCode: '16111',
    items: [{ productName: 'Jersey Custom', category: 'CUSTOM', size: 'L', color: 'Hitam', quantity: 2 } as never],
    quantity: 2,
    totalPrice: 500000,
    totalPaid: 0,
    remainingBalance: 500000,
    paymentPercentage: 0,
    design: null,
    designFileName: null,
    paymentStatus: 'BELUM_BAYAR',
    productionStatus: 'WAITING_VALIDATION',
    shippingStatus: 'NOT_SHIPPED',
    invoiceNumber: `INV-${counter}`,
    createdAt: new Date(2026, 8, 20, 10, 0, 0).toISOString(),
    isCustomOrder: true,
    ...overrides,
  } as Order;
}

export function makeUser(role: AdminUser['role'] = 'OWNER'): AdminUser {
  return { id: `user-${role}`, name: `User ${role}`, email: `${role.toLowerCase()}@sipastel.test`, role };
}
