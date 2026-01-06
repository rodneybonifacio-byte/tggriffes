import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  min_quantity: number;
  discount_type: 'percentage' | 'fixed_price' | 'fixed_discount';
  discount_value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  applies_to: 'all' | 'category' | 'product';
  category_id: string | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: { name: string } | null;
  product?: { name: string } | null;
}

export function usePromotions() {
  return useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          category:categories(name),
          product:products(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Promotion[];
    },
  });
}

export function usePromotion(id: string | undefined) {
  return useQuery({
    queryKey: ['promotions', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          category:categories(name),
          product:products(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Promotion | null;
    },
    enabled: !!id,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'category' | 'product'>) => {
      const { data, error } = await supabase
        .from('promotions')
        .insert(promotion)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...promotion }: Partial<Promotion> & { id: string }) => {
      const { data, error } = await supabase
        .from('promotions')
        .update(promotion)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

// Get applicable promotions for a cart
export function useApplicablePromotions(quantity: number, productId?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['applicable-promotions', quantity, productId, categoryId],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      let query = supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .lte('min_quantity', quantity)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('min_quantity', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by applicability
      const applicable = (data as Promotion[]).filter(promo => {
        if (promo.applies_to === 'all') return true;
        if (promo.applies_to === 'product' && promo.product_id === productId) return true;
        if (promo.applies_to === 'category' && promo.category_id === categoryId) return true;
        return false;
      });

      // Return the best promotion (highest min_quantity that applies)
      return applicable[0] || null;
    },
    enabled: quantity > 0,
  });
}
