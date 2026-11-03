import { describe, expect, test } from 'bun:test';
import { annualPriceCents, annualCoverageEnd, isCoveredByAnnual } from './billingRules';

describe('annual billing', () => {
  test('existing 20% discount makes twelve R$200 months cost R$1920', () => {
    expect(annualPriceCents(20000)).toBe(192000);
  });
  test('annual payment covers twelve months beginning with November', () => {
    expect(annualCoverageEnd('2026-11-01')).toBe('2027-11-01');
  });
  test('pending annual payment grants no coverage', () => {
    expect(isCoveredByAnnual({ status: 'PENDENTE', paid_at: null, reference_month: '2026-11-01', coverage_end: '2027-11-01' }, '2026-11-01')).toBe(false);
  });
  test('confirmed annual payment covers October but expires in November', () => {
    const paid = { status: 'PAGO', paid_at: '2026-11-03', reference_month: '2026-11-01', coverage_end: '2027-11-01' };
    expect(isCoveredByAnnual(paid, '2027-10-01')).toBe(true);
    expect(isCoveredByAnnual(paid, '2027-11-01')).toBe(false);
    expect(isCoveredByAnnual(paid, '2026-10-01')).toBe(false);
  });
});