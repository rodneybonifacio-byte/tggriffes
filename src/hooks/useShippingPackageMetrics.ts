import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShippingPackageMetrics {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

interface ShippingLine {
  productId: string;
  quantity: number;
}

const DEFAULT_WEIGHT_GRAMS_PER_ITEM = 300;
const DEFAULT_LENGTH_CM = 30;
const DEFAULT_WIDTH_CM = 30;
const DEFAULT_HEIGHT_CM_PER_ITEM = 2;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function computeMetrics(lines: ShippingLine[], productsById: Map<string, any>): ShippingPackageMetrics {
  if (!lines.length) {
    return {
      weightGrams: DEFAULT_WEIGHT_GRAMS_PER_ITEM,
      lengthCm: DEFAULT_LENGTH_CM,
      widthCm: DEFAULT_WIDTH_CM,
      heightCm: DEFAULT_HEIGHT_CM_PER_ITEM,
    };
  }

  let totalWeight = 0;
  let maxLength = DEFAULT_LENGTH_CM;
  let maxWidth = DEFAULT_WIDTH_CM;
  let totalHeight = 0;

  for (const line of lines) {
    const qty = Math.max(0, Math.round(line.quantity || 0));
    if (!qty) continue;

    const p = productsById.get(line.productId);

    const w = toNumber(p?.weight_grams) ?? DEFAULT_WEIGHT_GRAMS_PER_ITEM;
    const l = toNumber(p?.length_cm) ?? DEFAULT_LENGTH_CM;
    const wd = toNumber(p?.width_cm) ?? DEFAULT_WIDTH_CM;
    const h = toNumber(p?.height_cm) ?? DEFAULT_HEIGHT_CM_PER_ITEM;

    totalWeight += w * qty;
    maxLength = Math.max(maxLength, l);
    maxWidth = Math.max(maxWidth, wd);
    totalHeight += h * qty;
  }

  return {
    weightGrams: Math.max(1, Math.round(totalWeight || DEFAULT_WEIGHT_GRAMS_PER_ITEM)),
    lengthCm: Math.max(1, Math.round(maxLength)),
    widthCm: Math.max(1, Math.round(maxWidth)),
    heightCm: Math.max(1, Math.round(totalHeight || DEFAULT_HEIGHT_CM_PER_ITEM)),
  };
}

export function useShippingPackageMetrics(lines: ShippingLine[]) {
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lines) {
      if (l.productId) ids.add(l.productId);
    }
    return Array.from(ids);
  }, [lines]);

  const productIdsKey = useMemo(() => productIds.slice().sort().join(','), [productIds]);

  const productsQuery = useQuery({
    queryKey: ['shipping-products-dims', productIdsKey],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, weight_grams, length_cm, width_cm, height_cm')
        .in('id', productIds);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const productsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of productsQuery.data ?? []) {
      m.set(p.id, p);
    }
    return m;
  }, [productsQuery.data]);

  const metrics = useMemo(() => computeMetrics(lines, productsById), [lines, productsById]);

  return {
    metrics,
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
  };
}
