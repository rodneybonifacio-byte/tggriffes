import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from './useProducts';

export function useHomeOrganizationProducts() {
  return useQuery({
    queryKey: ['home-organization-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(*),
          product_variants(*),
          product_images(*)
        `)
        .eq('active', true);
      if (error) throw error;
      return data as Product[];
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateProductOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; display_order?: number | null; is_featured?: boolean; hidden_from_home?: boolean }[]) => {
      // Run in parallel
      await Promise.all(
        updates.map(({ id, ...fields }) =>
          supabase.from('products').update(fields).eq('id', id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-organization-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}