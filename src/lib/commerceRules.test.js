import { expect, test } from 'bun:test';
import {
  MIN_ORDER_QUANTITY,
  UNIT_PRICE_CENTS,
  STOREFRONT_INITIAL_ORDER_STATUS,
  MIN_DISTINCT_SIZES,
  BANNER_MIN_DISTINCT_SIZES,
  meetsOrderRule,
} from './commerceRules';

test('all storefront pieces cost R$ 35', () => {
  expect(UNIT_PRICE_CENTS).toBe(3500);
});

test('storefront orders require 10 pieces', () => {
  expect(MIN_ORDER_QUANTITY).toBe(10);
});

test('storefront checkout starts as a draft regardless of a staff session', () => {
  expect(STOREFRONT_INITIAL_ORDER_STATUS).toBe('RASCUNHO');
});

test('the purchase rule releases from 2 different sizes', () => {
  expect(MIN_DISTINCT_SIZES).toBe(2);
});

test('the banner warning still advertises 3 different sizes', () => {
  expect(BANNER_MIN_DISTINCT_SIZES).toBe(3);
});

test('10 pieces in 2 sizes is allowed', () => {
  expect(meetsOrderRule([{ size: 'P', quantity: 5 }, { size: 'M', quantity: 5 }])).toBe(true);
});

test('10 pieces in a single size is blocked', () => {
  expect(meetsOrderRule([{ size: 'M', quantity: 10 }])).toBe(false);
});

test('9 pieces in 2 sizes is blocked', () => {
  expect(meetsOrderRule([{ size: 'P', quantity: 5 }, { size: 'M', quantity: 4 }])).toBe(false);
});
