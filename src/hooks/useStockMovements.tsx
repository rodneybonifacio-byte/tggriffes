import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StockMovement {
  id: string;
  variant_id: string;
  product_id: string;
  movement_type: 'entrada' | 'saida' | 'ajuste' | 'venda' | 'cancelamento' | 'shopify_sale';
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  user_id: string | null;
  created_at: string;
  // Joined data
  product_name?: string;
  variant_size?: string;
  variant_color?: string | null;
  user_email?: string | null;
}

interface CreateMovementParams {
  variant_id: string;
  product_id: string;
  movement_type: 'entrada' | 'saida' | 'ajuste' | 'venda' | 'cancelamento';
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason?: string;
}

export function useStockMovements(productId?: string) {
  return useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(name),
          variant:product_variants(size, color)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((m: any) => ({
        ...m,
        product_name: m.product?.name,
        variant_size: m.variant?.size,
        variant_color: m.variant?.color,
      })) as StockMovement[];
    },
    enabled: true,
  });
}

export function useVariantMovements(variantId?: string) {
  return useQuery({
    queryKey: ['stock-movements', 'variant', variantId],
    queryFn: async () => {
      if (!variantId) return [];

      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('variant_id', variantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: !!variantId,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMovementParams) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('stock_movements')
        .insert({
          variant_id: params.variant_id,
          product_id: params.product_id,
          movement_type: params.movement_type,
          quantity: params.quantity,
          stock_before: params.stock_before,
          stock_after: params.stock_after,
          reason: params.reason || null,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useCreateBatchStockMovements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movements: CreateMovementParams[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      const records = movements.map(m => ({
        variant_id: m.variant_id,
        product_id: m.product_id,
        movement_type: m.movement_type,
        quantity: m.quantity,
        stock_before: m.stock_before,
        stock_after: m.stock_after,
        reason: m.reason || null,
        user_id: user?.id || null,
      }));

      const { error } = await supabase
        .from('stock_movements')
        .insert(records);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}
