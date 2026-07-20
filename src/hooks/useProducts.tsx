import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Product = Tables<'products'> & {
  categories?: Tables<'categories'> | null;
  product_variants?: Tables<'product_variants'>[];
  product_images?: Tables<'product_images'>[];
};

export type ProductVariant = Tables<'product_variants'>;
export type ProductImage = Tables<'product_images'>;
export type Category = Tables<'categories'>;

interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: 'active' | 'inactive' | 'all';
  stock?: 'all' | 'in-stock' | 'out-of-stock' | 'low-stock';
}

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          categories(*),
          product_variants(*),
          product_images(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);
      }

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters?.status === 'active') {
        query = query.eq('active', true);
      } else if (filters?.status === 'inactive') {
        query = query.eq('active', false);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      let products = data as Product[];

      // Filter by stock
      if (filters?.stock === 'in-stock') {
        products = products.filter(p => {
          const totalStock = p.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
          return totalStock > 0;
        });
      } else if (filters?.stock === 'out-of-stock') {
        products = products.filter(p => {
          const totalStock = p.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
          return totalStock === 0;
        });
      } else if (filters?.stock === 'low-stock') {
        products = products.filter(p => {
          const totalStock = p.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
          return totalStock > 0 && totalStock <= 3;
        });
      }

      return products;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - reduces DB calls significantly
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(*),
          product_variants(*),
          product_images(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id,
  });
}

export function useProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['product-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(*),
          product_variants(*),
          product_images(*)
        `)
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!slug,
    staleTime: 60 * 1000, // 1 minute - balances freshness with cost
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - categories rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Contagem/estoque leve para o dashboard admin.
 * Devolve apenas o que o dashboard precisa (produtos ativos, contagem total,
 * variantes com estoque baixo e sem estoque) SEM baixar todas as imagens e
 * variantes em memória no cliente.
 */
export interface DashboardStockVariant {
  id: string;
  size: string;
  color: string | null;
  stock_qty: number;
  productId: string;
  productName: string;
  productImage: string | null;
}

export interface DashboardStockSummary {
  totalProducts: number;
  activeProducts: number;
  lowStockVariants: DashboardStockVariant[];
  outOfStockCount: number;
}

export function useDashboardStockSummary() {
  return useQuery({
    queryKey: ['dashboard-stock-summary', 'v1'],
    queryFn: async (): Promise<DashboardStockSummary> => {
      // Duas queries de contagem (rápidas via head:true)
      const [totalRes, activeRes, outOfStockRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('stock_qty', 0),
      ]);
      if (totalRes.error) throw totalRes.error;
      if (activeRes.error) throw activeRes.error;
      if (outOfStockRes.error) throw outOfStockRes.error;

      // Variantes com estoque baixo (1..3) com nome + imagem do produto
      const { data: lowRows, error: lowErr } = await supabase
        .from('product_variants')
        .select('id, size, color, stock_qty, product_id, products(name, main_image_url)')
        .gt('stock_qty', 0)
        .lte('stock_qty', 3)
        .order('stock_qty', { ascending: true })
        .limit(50);
      if (lowErr) throw lowErr;

      const lowStockVariants: DashboardStockVariant[] = (lowRows ?? []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock_qty: v.stock_qty,
        productId: v.product_id,
        productName: v.products?.name ?? '',
        productImage: v.products?.main_image_url ?? null,
      }));

      return {
        totalProducts: totalRes.count ?? 0,
        activeProducts: activeRes.count ?? 0,
        lowStockVariants,
        outOfStockCount: outOfStockRes.count ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Busca o estoque atual apenas das variantes atualmente no carrinho.
 * Evita carregar o catálogo inteiro só para exibir o botão "+" com limite de estoque.
 */
export function useVariantsStock(variantIds: string[]) {
  const key = [...variantIds].sort().join(',');
  return useQuery({
    queryKey: ['variants-stock', key],
    queryFn: async () => {
      if (variantIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, stock_qty')
        .in('id', variantIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const v of data ?? []) map[v.id as string] = v.stock_qty as number;
      return map;
    },
    enabled: variantIds.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: TablesInsert<'products'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...product }: TablesUpdate<'products'> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First, archive in Shopify (non-blocking)
      supabase.functions.invoke('shopify-sync', {
        body: { action: 'delete_product', productId: id },
      }).catch(err => console.error('Shopify delete sync failed:', err));

      // Deactivate locally
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useToggleProductActive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ active })
        .eq('id', id);
      
      if (error) throw error;

      // Sync status to Shopify (non-blocking)
      if (active) {
        supabase.functions.invoke('shopify-sync', {
          body: { action: 'sync_product', productId: id },
        }).catch(err => console.error('Shopify activate sync failed:', err));
      } else {
        supabase.functions.invoke('shopify-sync', {
          body: { action: 'delete_product', productId: id },
        }).catch(err => console.error('Shopify archive sync failed:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (category: TablesInsert<'categories'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateVariantStock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (variants: { id: string; stock_qty: number }[]) => {
      const promises = variants.map(v => 
        supabase
          .from('product_variants')
          .update({ stock_qty: v.stock_qty })
          .eq('id', v.id)
      );
      
      await Promise.all(promises);
      
      // Auto-sync to Shopify (background, non-blocking)
      for (const v of variants) {
        supabase.functions.invoke('shopify-sync', {
          body: { 
            action: 'sync_variant_inventory',
            variantId: v.id,
            stockQty: v.stock_qty 
          },
        }).catch(err => console.error('Shopify auto-sync failed:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (variant: TablesInsert<'product_variants'>) => {
      const { data, error } = await supabase
        .from('product_variants')
        .insert(variant)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
