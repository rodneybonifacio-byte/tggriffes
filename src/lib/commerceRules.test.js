import { expect, test } from 'bun:test';
import { MIN_ORDER_QUANTITY, UNIT_PRICE_CENTS, STOREFRONT_INITIAL_ORDER_STATUS } from './commerceRules';

test('all storefront pieces cost R$ 35', () => {
  expect(UNIT_PRICE_CENTS).toBe(3500);
});

test('storefront orders require 10 pieces', () => {
  expect(MIN_ORDER_QUANTITY).toBe(10);
});

test('storefront checkout starts as a draft regardless of a staff session', () => {
  expect(STOREFRONT_INITIAL_ORDER_STATUS).toBe('RASCUNHO');
});
import { meetsOrderRule } from './commerceRules';
test('10 pieces in only 2 sizes is blocked', () => {
  expect(meetsOrderRule([{ size: 'P', quantity: 5 }, { size: 'M', quantity: 5 }])).toBe(false);
});
test('10 pieces in 3 sizes is allowed', () => {
  expect(meetsOrderRule([{ size: 'P', quantity: 4 }, { size: 'M', quantity: 3 }, { size: 'G', quantity: 3 }])).toBe(true);
});
test('9 pieces in 3 sizes is blocked', () => {
  expect(meetsOrderRule([{ size: 'P', quantity: 3 }, { size: 'M', quantity: 3 }, { size: 'G', quantity: 3 }])).toBe(false);
});
