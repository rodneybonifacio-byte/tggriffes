export const UNIT_PRICE_CENTS = 3_500;
export const MIN_ORDER_QUANTITY = 10;

// Storefront orders always wait for finalization, even with a staff session.
export const STOREFRONT_INITIAL_ORDER_STATUS = 'RASCUNHO';

export const MIN_DISTINCT_SIZES = 3;

export const countDistinctSizes = (items: { size: string }[]) =>
  new Set(items.map((i) => i.size.trim().toUpperCase()).filter(Boolean)).size;

export const meetsOrderRule = (items: { size: string; quantity: number }[]) =>
  items.reduce((s, i) => s + i.quantity, 0) >= MIN_ORDER_QUANTITY &&
  countDistinctSizes(items) >= MIN_DISTINCT_SIZES;
