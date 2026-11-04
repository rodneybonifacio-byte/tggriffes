import { describe, expect, test } from 'bun:test';
import { canViewBilling } from './billingAccess';

describe('billing access', () => {
  test('administrators can see and pay the monthly fee', () => {
    expect(canViewBilling('admin')).toBe(true);
  });
  test('collaborators can see and pay the monthly fee', () => {
    expect(canViewBilling('seller')).toBe(true);
  });
  test('store customers and visitors cannot see the monthly fee', () => {
    expect(canViewBilling('customer')).toBe(false);
    expect(canViewBilling(null)).toBe(false);
    expect(canViewBilling(undefined)).toBe(false);
  });
});
