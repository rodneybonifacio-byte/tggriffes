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