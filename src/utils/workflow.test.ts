import { describe, it, expect } from 'vitest';
import {
  PRODUCTION_STATUSES,
  getNextProductionStep,
  validateStatusChange,
  isOnProductionBoard,
  isInProduction,
  isNewOrder,
} from './workflow';

describe('production pipeline', () => {
  it('walks the whole pipeline one step at a time without skipping SEWING or design approval', () => {
    const path: string[] = ['WAITING_VALIDATION'];
    let current = getNextProductionStep('WAITING_VALIDATION');
    while (current) {
      path.push(current.next);
      current = getNextProductionStep(current.next);
    }
    expect(path).toEqual([
      'WAITING_VALIDATION',
      'DESIGN',
      'DESIGN_APPROVAL',
      'DESIGN_APPROVED',
      'CUTTING',
      'SEWING',
      'PRINTING',
      'QC',
      'PACKING',
      'READY_TO_SHIP',
    ]);
  });

  it('does not allow leaving design without approval', () => {
    expect(getNextProductionStep('DESIGN')?.next).toBe('DESIGN_APPROVAL');
    expect(getNextProductionStep('DESIGN_APPROVAL')?.next).toBe('DESIGN_APPROVED');
    expect(getNextProductionStep('DESIGN_REVISION')?.next).toBe('DESIGN_APPROVAL');
    expect(getNextProductionStep('DESIGN_APPROVED')?.next).toBe('CUTTING');
  });

  it('handles rework and the end of the line', () => {
    expect(getNextProductionStep('REWORK')?.next).toBe('QC');
    expect(getNextProductionStep('READY_TO_SHIP')).toBeNull();
  });

  it('every status is reachable in the ordered list exactly once', () => {
    expect(new Set(PRODUCTION_STATUSES).size).toBe(PRODUCTION_STATUSES.length);
    expect(PRODUCTION_STATUSES).toContain('PRODUCTION_QUEUE');
    expect(PRODUCTION_STATUSES).toContain('REWORK');
  });
});

describe('board membership helpers', () => {
  it('keeps shipped orders off the production board', () => {
    expect(isOnProductionBoard({ shippingStatus: 'NOT_SHIPPED' })).toBe(true);
    expect(isOnProductionBoard({ shippingStatus: 'SHIPPED' })).toBe(false);
    expect(isOnProductionBoard({ shippingStatus: 'COMPLETED' })).toBe(false);
  });
  it('classifies new vs in-production orders', () => {
    expect(isNewOrder({ productionStatus: 'WAITING_VALIDATION' })).toBe(true);
    expect(isNewOrder({ productionStatus: 'CUTTING' })).toBe(false);
    expect(isInProduction({ productionStatus: 'CUTTING', shippingStatus: 'NOT_SHIPPED' })).toBe(true);
    expect(isInProduction({ productionStatus: 'WAITING_VALIDATION', shippingStatus: 'NOT_SHIPPED' })).toBe(false);
    expect(isInProduction({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'NOT_SHIPPED' })).toBe(false);
    expect(isInProduction({ productionStatus: 'QC', shippingStatus: 'SHIPPED' })).toBe(false);
  });
});

describe('validateStatusChange', () => {
  it('allows saving without shipping', () => {
    expect(validateStatusChange({ productionStatus: 'CUTTING', shippingStatus: 'NOT_SHIPPED' })).toBeNull();
  });
  it('blocks shipping before the order is ready to ship', () => {
    expect(validateStatusChange({ productionStatus: 'QC', shippingStatus: 'SHIPPED', trackingNumber: 'X1' })).toMatch(/Siap Kirim/);
  });
  it('requires a tracking number for shipped / in transit', () => {
    expect(validateStatusChange({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'SHIPPED' })).toMatch(/resi/i);
    expect(validateStatusChange({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'IN_TRANSIT', trackingNumber: '   ' })).toMatch(/resi/i);
    expect(validateStatusChange({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'SHIPPED', trackingNumber: 'JNE123' })).toBeNull();
  });
  it('does not demand a tracking number for pickup-style completion', () => {
    expect(validateStatusChange({ productionStatus: 'READY_TO_SHIP', shippingStatus: 'COMPLETED' })).toBeNull();
  });
});
