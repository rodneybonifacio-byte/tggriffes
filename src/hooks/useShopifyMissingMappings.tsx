import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useCallback } from 'react';

interface MissingMappingProduct {
  product_id: string;
  product_name: string;
  product_slug: string;
  missing_variants: number;
  total_variants: number;
}

export function useMissingMappingProducts() {
  return useQuery({
    queryKey: ['shopify-missing-mappings'],
    queryFn: async () => {
      // Get active products with their variants
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, product_variants(id)')
        .eq('active', true);

      if (productsError) throw productsError;

      // Get all existing variant mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('shopify_variant_mappings')
        .select('variant_id, shopify_inventory_item_id');

      if (mappingsError) throw mappingsError;

      // Create a set of mapped variant IDs (only those with inventory_item_id)
      const mappedVariantIds = new Set(
        (mappings || [])
          .filter(m => m.shopify_inventory_item_id)
          .map(m => m.variant_id)
      );

      // Find products with missing mappings
      const productsWithMissing: MissingMappingProduct[] = [];

      for (const product of products || []) {
        const variants = product.product_variants || [];
        const missingCount = variants.filter(v => !mappedVariantIds.has(v.id)).length;

        if (missingCount > 0) {
          productsWithMissing.push({
            product_id: product.id,
            product_name: product.name,
            product_slug: product.slug,
            missing_variants: missingCount,
            total_variants: variants.length,
          });
        }
      }

      return productsWithMissing;
    },
    staleTime: 30_000, // 30 seconds
  });
}

export interface FixMappingsProgress {
  current: number;
  total: number;
  currentProduct: string;
  results: { productId: string; productName: string; success: boolean; error?: string }[];
  isRunning: boolean;
  isPaused: boolean;
  currentBatch: number;
  totalBatches: number;
}

const BATCH_SIZE = 20;

export function useFixMissingMappings() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<FixMappingsProgress>({
    current: 0,
    total: 0,
    currentProduct: '',
    results: [],
    isRunning: false,
    isPaused: false,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [pendingProducts, setPendingProducts] = useState<MissingMappingProduct[]>([]);

  const fixMappings = useCallback(async (products: MissingMappingProduct[]) => {
    if (products.length === 0) {
      toast.info('Nenhum produto com mapeamento faltante.');
      return;
    }

    const totalBatches = Math.ceil(products.length / BATCH_SIZE);
    
    setPendingProducts(products);
    setProgress({
      current: 0,
      total: products.length,
      currentProduct: '',
      results: [],
      isRunning: true,
      isPaused: false,
      currentBatch: 1,
      totalBatches,
    });

    await processBatch(products, 0, [], totalBatches);
  }, [queryClient]);

  const processBatch = useCallback(async (
    products: MissingMappingProduct[], 
    startIndex: number, 
    previousResults: FixMappingsProgress['results'],
    totalBatches: number
  ) => {
    const results = [...previousResults];
    const endIndex = Math.min(startIndex + BATCH_SIZE, products.length);
    const currentBatch = Math.floor(startIndex / BATCH_SIZE) + 1;

    setProgress(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentBatch,
    }));

    for (let i = startIndex; i < endIndex; i++) {
      const product = products[i];
      
      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentProduct: product.product_name,
      }));

      try {
        const { error } = await supabase.functions.invoke('shopify-sync', {
          body: { action: 'sync_product', productId: product.product_id },
        });

        if (error) throw error;

        results.push({
          productId: product.product_id,
          productName: product.product_name,
          success: true,
        });
      } catch (err: any) {
        results.push({
          productId: product.product_id,
          productName: product.product_name,
          success: false,
          error: err.message || 'Erro desconhecido',
        });
      }

      setProgress(prev => ({ ...prev, results: [...results] }));

      // Small delay to avoid rate limiting
      if (i < endIndex - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // Check if there are more batches
    if (endIndex < products.length) {
      // Pause after batch
      setProgress(prev => ({ 
        ...prev, 
        isRunning: false, 
        isPaused: true,
        results: [...results],
      }));
      setPendingProducts(products);
    } else {
      // All done
      setProgress(prev => ({ 
        ...prev, 
        isRunning: false, 
        isPaused: false,
        currentProduct: '',
      }));

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['shopify-missing-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-product-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-sync-logs'] });

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (errorCount === 0) {
        toast.success(`${successCount} produtos corrigidos com sucesso!`);
      } else if (successCount > 0) {
        toast.warning(`${successCount} corrigidos, ${errorCount} com erro.`);
      } else {
        toast.error(`Falha ao corrigir ${errorCount} produtos.`);
      }
    }
  }, [queryClient]);

  const continueProcessing = useCallback(async () => {
    if (!progress.isPaused || pendingProducts.length === 0) return;
    
    const nextStartIndex = progress.current;
    await processBatch(pendingProducts, nextStartIndex, progress.results, progress.totalBatches);
  }, [progress, pendingProducts, processBatch]);

  const reset = useCallback(() => {
    setPendingProducts([]);
    setProgress({
      current: 0,
      total: 0,
      currentProduct: '',
      results: [],
      isRunning: false,
      isPaused: false,
      currentBatch: 0,
      totalBatches: 0,
    });
  }, []);

  return { fixMappings, continueProcessing, progress, reset };
}
