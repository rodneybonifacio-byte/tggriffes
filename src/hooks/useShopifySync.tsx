import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShopifySyncLog {
  id: string;
  sync_type: string;
  status: string;
  products_synced: number;
  variants_synced: number;
  errors: any;
  created_at: string;
}

export interface ShopifyProductMapping {
  id: string;
  product_id: string;
  shopify_product_id: string;
  shopify_product_handle: string | null;
  last_synced_at: string;
  created_at: string;
}

export function useShopifySyncLogs() {
  return useQuery({
    queryKey: ['shopify-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ShopifySyncLog[];
    },
  });
}

export function useShopifyProductMappings() {
  return useQuery({
    queryKey: ['shopify-product-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_product_mappings')
        .select('*')
        .order('last_synced_at', { ascending: false });

      if (error) throw error;
      return data as ShopifyProductMapping[];
    },
  });
}

export function useSyncAllProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('shopify-sync', {
        body: { action: 'sync_all' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-product-mappings'] });
      
      if (data.errors?.length > 0) {
        toast.warning(`Sincronização parcial: ${data.productsProcessed} produtos, ${data.errors.length} erros`);
      } else {
        toast.success(`${data.productsProcessed} produtos sincronizados com Shopify!`);
      }
    },
    onError: (error: any) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });
}

export function useSyncPendingProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('shopify-sync', {
        body: { action: 'sync_pending' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-product-mappings'] });
      
      if (data.errors?.length > 0) {
        toast.warning(`Sincronização parcial: ${data.productsProcessed} de ${data.pendingCount} pendentes, ${data.errors.length} erros`);
      } else {
        toast.success(`${data.productsProcessed} produtos pendentes sincronizados!`);
      }
    },
    onError: (error: any) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });
}

export function useSyncSingleProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.functions.invoke('shopify-sync', {
        body: { action: 'sync_product', productId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-product-mappings'] });
      toast.success('Produto sincronizado com Shopify!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao sincronizar produto: ${error.message}`);
    },
  });
}

export function useSyncInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('shopify-sync', {
        body: { action: 'sync_inventory' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });
      
      if (data.errors?.length > 0) {
        toast.warning(`Estoque parcialmente sincronizado: ${data.variantsSynced} variantes, ${data.errors.length} erros`);
      } else {
        toast.success(`Estoque de ${data.variantsSynced} variantes sincronizado!`);
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao sincronizar estoque: ${error.message}`);
    },
  });
}

export function useCleanupOrphans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('shopify-sync', {
        body: { action: 'cleanup_orphans' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-product-mappings'] });
      
      if (data.cleaned > 0) {
        toast.success(`${data.cleaned} produtos órfãos arquivados no Shopify!`);
      } else {
        toast.info('Nenhum produto órfão encontrado.');
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao limpar órfãos: ${error.message}`);
    },
  });
}

// Function to sync inventory automatically (call from stock update hooks)
export async function syncVariantInventoryToShopify(variantId: string, stockQty: number) {
  try {
    await supabase.functions.invoke('shopify-sync', {
      body: { 
        action: 'sync_variant_inventory',
        variantId,
        stockQty 
      },
    });
  } catch (error) {
    console.error('Auto-sync to Shopify failed:', error);
    // Don't throw - this is a background sync
  }
}
