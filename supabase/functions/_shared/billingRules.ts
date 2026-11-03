export const ANNUAL_DISCOUNT_PERCENT = 20;

export function annualPriceCents(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * (100 - ANNUAL_DISCOUNT_PERCENT) / 100);
}

export function annualCoverageEnd(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(year + 1, month - 1, 1)).toISOString().slice(0, 10);
}

export function isCoveredByAnnual(invoice: { status: string; paid_at?: string | null; reference_month: string; coverage_end?: string | null }, month: string): boolean {
  return invoice.status === 'PAGO' && !!invoice.paid_at && !!invoice.coverage_end &&
    invoice.reference_month <= month && month < invoice.coverage_end;
}