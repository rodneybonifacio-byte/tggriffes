import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyProduct {
  id?: string;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  images?: { src: string }[];
  variants?: ShopifyVariant[];
}

interface ShopifyVariant {
  id?: string;
  product_id?: string;
  title: string;
  price: string;
  option1: string | null;
  option2: string | null;
  sku: string | null;
  inventory_item_id?: string;
  inventory_quantity?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
      throw new Error('Missing Shopify credentials');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const body = await req.json();
    const { action, productId, variantId, stockQty, nameQuery } = body;

    // Shopify API base URL - ensure no trailing slashes or extra chars
    const cleanDomain = SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const shopifyApiUrl = `https://${cleanDomain}/admin/api/2024-01`;

    console.log(`Using Shopify API URL: ${shopifyApiUrl}`);

    // Helper function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const isAbsoluteHttpUrl = (value: string) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    async function shopifyRequest(endpoint: string, method: string = 'GET', body?: any, retries = 3): Promise<any> {
      const url = `${shopifyApiUrl}${endpoint}`;
      console.log(`Shopify request: ${method} ${url}`);
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, {
            method,
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN!,
              'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          const responseText = await response.text();
          
          // Check if response is HTML (error page) - likely rate limiting
          if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
            if (attempt < retries) {
              console.log(`Shopify returned HTML, retry ${attempt}/${retries} after delay...`);
              await delay(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
              continue;
            }
            console.error(`Shopify returned HTML after ${retries} retries: ${responseText.substring(0, 200)}`);
            throw new Error(`Shopify API rate limited - please try again later`);
          }

          // Handle 429 Too Many Requests
          if (response.status === 429) {
            if (attempt < retries) {
              const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
              console.log(`Rate limited, waiting ${retryAfter}s before retry ${attempt}/${retries}`);
              await delay(retryAfter * 1000);
              continue;
            }
            throw new Error('Shopify API rate limited - please try again later');
          }

          if (!response.ok) {
            console.error(`Shopify API error: ${response.status} - ${responseText}`);
            throw new Error(`Shopify API error: ${response.status} - ${responseText}`);
          }

          return JSON.parse(responseText);
        } catch (err: any) {
          if (attempt === retries) throw err;
          console.log(`Request failed, retry ${attempt}/${retries}: ${err.message}`);
          await delay(1000 * attempt);
        }
      }
    }

    // Cache location ID to avoid repeated API calls
    let cachedLocationId: string | null = null;

    // Get location ID for inventory updates (cached)
    // Prefer a location that fulfills online orders when available.
    async function getLocationId(): Promise<string> {
      if (cachedLocationId !== null) {
        return cachedLocationId;
      }

      const { locations } = await shopifyRequest('/locations.json');
      if (!locations || locations.length === 0) {
        throw new Error('No Shopify locations found');
      }

      const preferred =
        locations.find((l: any) => l?.active === true && l?.fulfills_online_orders === true) ||
        locations.find((l: any) => l?.active === true) ||
        locations[0];

      const locationId = preferred.id.toString();
      cachedLocationId = locationId;
      console.log(
        `Selected Shopify location for inventory: ${preferred?.name ?? 'unknown'} (${locationId})`
      );
      return locationId;
    }

    async function getLocations(): Promise<any[]> {
      const { locations } = await shopifyRequest('/locations.json');
      return locations || [];
    }

    async function connectInventoryItem(locationId: string, inventoryItemId: string) {
      // Connect inventory item to location (required in some multi-location setups)
      try {
        await shopifyRequest('/inventory_levels/connect.json', 'POST', {
          location_id: parseInt(locationId),
          inventory_item_id: parseInt(inventoryItemId),
          relocate_if_necessary: true,
        });
      } catch (err: any) {
        // Non-fatal: item might already be connected or Shopify may reject connect in some cases.
        console.log(`Connect inventory ignored: ${inventoryItemId}@${locationId} -> ${err.message}`);
      }
    }

    async function getInventoryLevels(inventoryItemIds: string[], locationIds?: string[]): Promise<any[]> {
      if (!inventoryItemIds.length) return [];
      const params = new URLSearchParams({
        inventory_item_ids: inventoryItemIds.join(','),
      });
      if (locationIds?.length) {
        params.set('location_ids', locationIds.join(','));
      }
      const { inventory_levels } = await shopifyRequest(`/inventory_levels.json?${params.toString()}`);
      return inventory_levels || [];
    }

    async function getShopifyProduct(shopifyProductId: string): Promise<any> {
      const { product } = await shopifyRequest(`/products/${shopifyProductId}.json`);
      return product;
    }

    // Sync a single product to Shopify
    async function syncProduct(product: any) {
      const { data: existingMapping } = await supabase
        .from('shopify_product_mappings')
        .select('*')
        .eq('product_id', product.id)
        .single();

      // Build Shopify product data
      const shopifyProduct: ShopifyProduct = {
        title: product.name,
        body_html: product.description || '',
        vendor: 'TG Griffes',
        product_type: product.category?.name || 'Camiseta',
        handle: product.slug,
        status: product.active ? 'active' : 'draft',
      };

      // Add main image
      // Shopify exige URL absoluta pública. Se vier como "/products/...", ignoramos para não quebrar a sync.
      if (product.main_image_url && isAbsoluteHttpUrl(product.main_image_url)) {
        shopifyProduct.images = [{ src: product.main_image_url }];
      } else if (product.main_image_url) {
        console.log(`Skipping non-absolute image URL for product ${product.id}: ${product.main_image_url}`);
      }

      // Build variants with size and color options - fixed price R$69,90
      const FIXED_PRICE = '69.90';
      const variants = product.variants || [];
      
      // Check if any variant has a color defined
      const hasColors = variants.some((v: any) => v.color && v.color.trim() !== '');
      
      if (variants.length > 0) {
        shopifyProduct.variants = variants.map((v: any) => ({
          price: FIXED_PRICE,
          option1: v.size,
          option2: hasColors ? (v.color || 'Única') : null,
          sku: v.sku || `${product.slug}-${v.size}-${v.color || 'default'}`,
          title: hasColors && v.color ? `${v.size} / ${v.color}` : v.size,
          inventory_management: 'shopify',
          inventory_quantity: v.stock_qty,
        }));
      }

      let shopifyProductId: string;
      let shopifyHandle: string;
      let createdVariants: any[] = [];

      if (existingMapping) {
        // Update existing product
        const updateData: any = {
          product: {
            id: existingMapping.shopify_product_id,
            ...shopifyProduct,
          }
        };

        const result = await shopifyRequest(
          `/products/${existingMapping.shopify_product_id}.json`,
          'PUT',
          updateData
        );
        
        shopifyProductId = result.product.id.toString();
        shopifyHandle = result.product.handle;
        createdVariants = result.product.variants || [];

        // Extract Shopify CDN image URL (if available)
        const shopifyImages = result.product.images || [];
        const shopifyImageUrl = shopifyImages.length > 0 ? shopifyImages[0].src : null;

        // Update mapping and save Shopify CDN image URL to products table
        await supabase
          .from('shopify_product_mappings')
          .update({ 
            last_synced_at: new Date().toISOString(),
            shopify_product_handle: shopifyHandle 
          })
          .eq('id', existingMapping.id);

        // Store Shopify CDN URL in products table for frontend use
        if (shopifyImageUrl) {
          await supabase
            .from('products')
            .update({ shopify_image_url: shopifyImageUrl })
            .eq('id', product.id);
          console.log(`Updated shopify_image_url for product ${product.id}: ${shopifyImageUrl}`);
        }

      } else {
        // Create new product with options based on variants
        // Only add Color option if at least one variant has a color
        const hasColors = variants.some((v: any) => v.color && v.color.trim() !== '');
        
        const productOptions = [{ name: 'Tamanho' }];
        if (hasColors) {
          productOptions.push({ name: 'Cor' });
        }
        
        const createData: any = {
          product: {
            ...shopifyProduct,
            options: productOptions,
          }
        };

        const result = await shopifyRequest('/products.json', 'POST', createData);
        
        shopifyProductId = result.product.id.toString();
        shopifyHandle = result.product.handle;
        createdVariants = result.product.variants || [];

        // Extract Shopify CDN image URL (if available)
        const shopifyImages = result.product.images || [];
        const shopifyImageUrl = shopifyImages.length > 0 ? shopifyImages[0].src : null;

        // Save mapping
        await supabase
          .from('shopify_product_mappings')
          .insert({
            product_id: product.id,
            shopify_product_id: shopifyProductId,
            shopify_product_handle: shopifyHandle,
          });

        // Store Shopify CDN URL in products table for frontend use
        if (shopifyImageUrl) {
          await supabase
            .from('products')
            .update({ shopify_image_url: shopifyImageUrl })
            .eq('id', product.id);
          console.log(`Saved shopify_image_url for new product ${product.id}: ${shopifyImageUrl}`);
        }
      }

      // Map variants (robusto): NÃO depende de posição/índice; usa SKU e fallback por opções.
      const variantsBySku = new Map<string, any>();
      const variantsByOptions = new Map<string, any>();
      for (const v of createdVariants || []) {
        if (v?.sku) variantsBySku.set(String(v.sku), v);
        const key = `${String(v?.option1 ?? '')}|${String(v?.option2 ?? '')}`;
        variantsByOptions.set(key, v);
      }

      for (const localVariant of variants) {
        const expectedSku = localVariant.sku || `${product.slug}-${localVariant.size}-${localVariant.color || 'default'}`;
        const expectedOption1 = localVariant.size;
        const expectedOption2 = hasColors ? (localVariant.color || 'Única') : null;
        const optionKey = `${String(expectedOption1 ?? '')}|${String(expectedOption2 ?? '')}`;

        const shopifyVariant = variantsBySku.get(String(expectedSku)) || variantsByOptions.get(optionKey);

        if (!shopifyVariant) {
          console.log(
            `Could not match Shopify variant for local variant ${localVariant.id} (sku=${expectedSku}, options=${optionKey})`
          );
          continue;
        }

        const { data: existingVarMapping } = await supabase
          .from('shopify_variant_mappings')
          .select('*')
          .eq('variant_id', localVariant.id)
          .single();

        if (!existingVarMapping) {
          await supabase
            .from('shopify_variant_mappings')
            .insert({
              variant_id: localVariant.id,
              shopify_variant_id: shopifyVariant.id?.toString() || null,
              shopify_inventory_item_id: shopifyVariant.inventory_item_id?.toString() || null,
              last_synced_at: new Date().toISOString(),
            });
        } else {
          await supabase
            .from('shopify_variant_mappings')
            .update({
              last_synced_at: new Date().toISOString(),
              shopify_variant_id: shopifyVariant.id?.toString() || existingVarMapping.shopify_variant_id,
              shopify_inventory_item_id: shopifyVariant.inventory_item_id?.toString() || null,
            })
            .eq('id', existingVarMapping.id);
        }
      }

      return { shopifyProductId, shopifyHandle, variantCount: createdVariants.length };
    }

    // Sync inventory for a single variant
    async function syncVariantInventory(variantId: string, stockQty: number) {
      const { data: mapping } = await supabase
        .from('shopify_variant_mappings')
        .select('*')
        .eq('variant_id', variantId)
        .single();

      if (!mapping || !mapping.shopify_inventory_item_id) {
        console.log(`No Shopify mapping for variant ${variantId}`);
        return { synced: false, reason: 'No mapping found' };
      }

      const locationId = await getLocationId();

      await connectInventoryItem(locationId, String(mapping.shopify_inventory_item_id));

      // Set inventory level
      await shopifyRequest('/inventory_levels/set.json', 'POST', {
        location_id: parseInt(locationId),
        inventory_item_id: parseInt(mapping.shopify_inventory_item_id),
        available: stockQty,
      });

      await supabase
        .from('shopify_variant_mappings')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', mapping.id);

      return { synced: true, shopifyVariantId: mapping.shopify_variant_id };
    }

    // Archive/delete product from Shopify
    async function archiveShopifyProduct(productId: string) {
      // Get mapping
      const { data: mapping } = await supabase
        .from('shopify_product_mappings')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (!mapping) {
        console.log(`No Shopify mapping for product ${productId}`);
        return { archived: false, reason: 'No mapping found' };
      }

      try {
        // Set product status to 'archived' in Shopify (keeps the product but hides it)
        await shopifyRequest(
          `/products/${mapping.shopify_product_id}.json`,
          'PUT',
          { product: { id: mapping.shopify_product_id, status: 'archived' } }
        );

        // Delete local mappings
        await supabase
          .from('shopify_variant_mappings')
          .delete()
          .in('variant_id', (
            await supabase
              .from('product_variants')
              .select('id')
              .eq('product_id', productId)
          ).data?.map(v => v.id) || []);

        await supabase
          .from('shopify_product_mappings')
          .delete()
          .eq('product_id', productId);

        return { archived: true, shopifyProductId: mapping.shopify_product_id };
      } catch (err: any) {
        console.error(`Failed to archive Shopify product: ${err.message}`);
        // Even if Shopify fails, clean up local mappings
        await supabase
          .from('shopify_product_mappings')
          .delete()
          .eq('product_id', productId);
        
        return { archived: false, error: err.message };
      }
    }

    // Cleanup orphaned products (exist in Shopify but not locally)
    async function cleanupOrphans() {
      // Get all local product IDs
      const { data: localProducts } = await supabase
        .from('products')
        .select('id')
        .eq('active', true);
      
      const localProductIds = new Set((localProducts || []).map(p => p.id));

      // Get all mappings
      const { data: mappings } = await supabase
        .from('shopify_product_mappings')
        .select('*');

      const orphanedMappings = (mappings || []).filter(m => !localProductIds.has(m.product_id));
      
      console.log(`Found ${orphanedMappings.length} orphaned product mappings`);

      const results = [];
      const errors = [];

      for (const mapping of orphanedMappings) {
        try {
          // Archive in Shopify
          await shopifyRequest(
            `/products/${mapping.shopify_product_id}.json`,
            'PUT',
            { product: { id: mapping.shopify_product_id, status: 'archived' } }
          );
          
          // Delete variant mappings first
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', mapping.product_id);
          
          if (variants && variants.length > 0) {
            await supabase
              .from('shopify_variant_mappings')
              .delete()
              .in('variant_id', variants.map(v => v.id));
          }

          // Delete product mapping
          await supabase
            .from('shopify_product_mappings')
            .delete()
            .eq('id', mapping.id);

          results.push({ productId: mapping.product_id, shopifyId: mapping.shopify_product_id });
          await delay(500);
        } catch (err: any) {
          console.error(`Error cleaning up ${mapping.shopify_product_id}: ${err.message}`);
          errors.push({ shopifyId: mapping.shopify_product_id, error: err.message });
        }
      }

      return { cleaned: results.length, errors };
    }

    let result: any;
    let syncLog: any = {
      sync_type: action,
      status: 'success',
      products_synced: 0,
      variants_synced: 0,
      errors: null,
    };

    try {
      // NEW: sync_batch action - syncs a limited batch to avoid timeout
      if (action === 'sync_batch') {
        const { offset = 0, limit = 30, onlyMissingImages = true } = body;
        
        // Build query for products needing sync
        let query = supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(*)
          `)
          .eq('active', true);
        
        // Only sync products missing shopify_image_url (most common use case)
        if (onlyMissingImages) {
          query = query.is('shopify_image_url', null);
        }
        
        const { data: allProducts, count } = await query
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);
        
        // Get total count for progress
        let countQuery = supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('active', true);
        if (onlyMissingImages) {
          countQuery = countQuery.is('shopify_image_url', null);
        }
        const { count: totalCount } = await countQuery;
        
        console.log(`Batch sync: offset=${offset}, limit=${limit}, found=${allProducts?.length || 0}, totalPending=${totalCount}`);

        const results = [];
        const errors = [];

        for (let i = 0; i < (allProducts || []).length; i++) {
          const product = (allProducts || [])[i];
          try {
            console.log(`[Batch] Processing ${offset + i + 1}: ${product.name}`);
            const syncResult = await syncProduct(product);
            results.push({ id: product.id, name: product.name, ...syncResult });
            syncLog.products_synced++;
            syncLog.variants_synced += syncResult.variantCount;
            
            // Delay to avoid rate limits
            await delay(700);
          } catch (err: any) {
            console.error(`Error syncing ${product.name}: ${err.message}`);
            errors.push({ productId: product.id, productName: product.name, error: err.message });
            await delay(400);
          }
        }

        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }

        const processedCount = offset + results.length;
        const hasMore = (totalCount || 0) > processedCount;

        result = { 
          message: 'Batch sync completed', 
          processed: results.length,
          offset,
          nextOffset: hasMore ? offset + limit : null,
          totalPending: totalCount || 0,
          remainingCount: Math.max(0, (totalCount || 0) - processedCount),
          hasMore,
          errors 
        };

      } else if (action === 'sync_all' || action === 'sync_pending') {
        // Get already synced product IDs
        const { data: mappings } = await supabase
          .from('shopify_product_mappings')
          .select('product_id');
        
        const syncedIds = new Set((mappings || []).map(m => m.product_id));

        // Get all active products
        const { data: allProducts } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(*)
          `)
          .eq('active', true);

        // Separate pending and already synced
        const pendingProducts = (allProducts || []).filter(p => !syncedIds.has(p.id));
        const syncedProducts = (allProducts || []).filter(p => syncedIds.has(p.id));
        
        // For sync_pending, only process pending. For sync_all, prioritize pending first
        const productsToSync = action === 'sync_pending' 
          ? pendingProducts 
          : [...pendingProducts, ...syncedProducts];

        console.log(`Syncing ${productsToSync.length} products (${pendingProducts.length} pending, ${syncedProducts.length} existing)`);

        const results = [];
        const errors = [];
        const BATCH_SIZE = 15; // Process in smaller batches

        for (let i = 0; i < productsToSync.length; i++) {
          const product = productsToSync[i];
          try {
            console.log(`Processing ${i + 1}/${productsToSync.length}: ${product.name}`);
            const syncResult = await syncProduct(product);
            results.push(syncResult);
            syncLog.products_synced++;
            syncLog.variants_synced += syncResult.variantCount;
            
            // Longer delay every BATCH_SIZE products
            if ((i + 1) % BATCH_SIZE === 0) {
              console.log(`Batch complete, pausing 2s...`);
              await delay(2000);
            } else {
              // Normal delay between products
              await delay(600);
            }
          } catch (err: any) {
            console.error(`Error syncing ${product.name}: ${err.message}`);
            errors.push({ productId: product.id, productName: product.name, error: err.message });
            await delay(500);
          }
        }

        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }

        result = { 
          message: action === 'sync_pending' ? 'Pending products synced' : 'Sync completed', 
          productsProcessed: results.length,
          pendingCount: pendingProducts.length,
          existingCount: syncedProducts.length,
          errors 
        };

      } else if (action === 'sync_product' && productId) {
        // Sync single product
        const { data: product } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(*)
          `)
          .eq('id', productId)
          .single();

        if (!product) {
          throw new Error('Product not found');
        }

        const syncResult = await syncProduct(product);
        syncLog.products_synced = 1;
        syncLog.variants_synced = syncResult.variantCount;

        result = { 
          message: 'Product synced', 
          shopifyProductId: syncResult.shopifyProductId,
          handle: syncResult.shopifyHandle 
        };

      } else if (action === 'sync_inventory') {
        // Sync inventory
        console.log('Starting inventory sync...');
        
        // Get all variant mappings with inventory IDs
        const { data: mappings, error: mappingError } = await supabase
          .from('shopify_variant_mappings')
          .select('variant_id, shopify_variant_id, shopify_inventory_item_id')
          .not('shopify_inventory_item_id', 'is', null);

        if (mappingError) {
          console.error('Mapping query error:', mappingError);
          throw mappingError;
        }

        console.log(`Found ${mappings?.length || 0} variant mappings`);

        if (!mappings || mappings.length === 0) {
          result = { message: 'No mapped variants to sync', variantsSynced: 0, errors: [] };
        } else {
          // Create a lookup map for quick access
          const mappingLookup = new Map(mappings.map(m => [m.variant_id, m]));
          const variantIds = mappings.map(m => m.variant_id);

          // Get variants with their products (paginated for large datasets)
          const CHUNK_SIZE = 500;
          let allVariants: any[] = [];
          
          for (let i = 0; i < variantIds.length; i += CHUNK_SIZE) {
            const chunk = variantIds.slice(i, i + CHUNK_SIZE);
            const { data: variants } = await supabase
              .from('product_variants')
              .select('id, stock_qty, product_id, products(active)')
              .in('id', chunk);
            if (variants) allVariants = [...allVariants, ...variants];
          }

          // Filter only active products
          const activeVariants = allVariants.filter(v => v.products?.active === true);
          console.log(`Found ${activeVariants.length} active variants to sync`);

          const results = [];
          const errors = [];
          const BATCH_SIZE = 20;
          let locationId: string | null = null;

          for (let i = 0; i < activeVariants.length; i++) {
            const variant = activeVariants[i];
            const mapping = mappingLookup.get(variant.id);
            
            try {
              if (!mapping?.shopify_inventory_item_id) {
                continue;
              }

              // Get location ID once
              if (!locationId) {
                locationId = await getLocationId();
                console.log(`Using location ID: ${locationId}`);
              }

               await connectInventoryItem(locationId, String(mapping.shopify_inventory_item_id));

              // Set inventory level
              await shopifyRequest('/inventory_levels/set.json', 'POST', {
                location_id: parseInt(locationId),
                inventory_item_id: parseInt(mapping.shopify_inventory_item_id),
                available: variant.stock_qty,
              });

              results.push({ variantId: variant.id, stock: variant.stock_qty });
              syncLog.variants_synced++;

              // Log progress and pause every batch
              if ((i + 1) % BATCH_SIZE === 0) {
                console.log(`Synced ${i + 1}/${activeVariants.length} variants`);
                await delay(300);
              }
            } catch (err: any) {
              console.error(`Error syncing variant ${variant.id}: ${err.message}`);
              errors.push({ variantId: variant.id, error: err.message });
            }
          }

          console.log(`Inventory sync completed: ${results.length} synced, ${errors.length} errors`);

          if (errors.length > 0) {
            syncLog.status = 'partial';
            syncLog.errors = errors;
          }

          result = { 
            message: 'Inventory sync completed', 
            variantsSynced: results.length,
            errors 
          };
        }

      } else if (action === 'sync_inventory_for_name') {
        if (!nameQuery || typeof nameQuery !== 'string' || nameQuery.trim().length < 2) {
          throw new Error('Missing nameQuery');
        }

        const query = nameQuery.trim();
        console.log(`Starting inventory sync for products nameQuery="${query}"`);

        const { data: products } = await supabase
          .from('products')
          .select('id, name, active')
          .ilike('name', `${query}%`)
          .eq('active', true);

        const productIds = (products || []).map(p => p.id);
        if (productIds.length === 0) {
          result = { message: 'No matching products', products: 0, variantsSynced: 0, errors: [] };
        } else {
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, stock_qty, product_id')
            .in('product_id', productIds);

          const variantIds = (variants || []).map(v => v.id);
          const { data: mappings } = await supabase
            .from('shopify_variant_mappings')
            .select('variant_id, shopify_inventory_item_id')
            .in('variant_id', variantIds)
            .not('shopify_inventory_item_id', 'is', null);

          const mappingLookup = new Map((mappings || []).map(m => [m.variant_id, m]));

          const errors: any[] = [];
          const synced: any[] = [];
          const BATCH_SIZE = 20;
          let locationId: string | null = null;

          for (let i = 0; i < (variants || []).length; i++) {
            const v = (variants || [])[i];
            const m = mappingLookup.get(v.id);
            if (!m?.shopify_inventory_item_id) continue;

            try {
              if (!locationId) {
                locationId = await getLocationId();
              }

              await connectInventoryItem(locationId, String(m.shopify_inventory_item_id));

              await shopifyRequest('/inventory_levels/set.json', 'POST', {
                location_id: parseInt(locationId),
                inventory_item_id: parseInt(String(m.shopify_inventory_item_id)),
                available: v.stock_qty,
              });

              synced.push({ variantId: v.id, stock: v.stock_qty, productId: v.product_id });
              syncLog.variants_synced++;

              if ((synced.length + errors.length) % BATCH_SIZE === 0) {
                console.log(`Synced ${synced.length} variants for nameQuery="${query}"`);
                await delay(300);
              }
            } catch (err: any) {
              errors.push({ variantId: v.id, error: err.message });
            }
          }

          if (errors.length > 0) {
            syncLog.status = 'partial';
            syncLog.errors = errors;
          }

          result = {
            message: 'Inventory sync completed (filtered)',
            products: productIds.length,
            variantsSynced: synced.length,
            errors,
          };
        }

      } else if (action === 'debug_product_inventory' && productId) {
        // Debug inventory mismatch between local DB and Shopify
        const { data: mapping } = await supabase
          .from('shopify_product_mappings')
          .select('*')
          .eq('product_id', productId)
          .single();

        if (!mapping) {
          throw new Error('No Shopify mapping for product');
        }

        const { data: localVariants } = await supabase
          .from('product_variants')
          .select('id, size, color, stock_qty')
          .eq('product_id', productId);

        const { data: localMappings } = await supabase
          .from('shopify_variant_mappings')
          .select('variant_id, shopify_variant_id, shopify_inventory_item_id')
          .in('variant_id', (localVariants || []).map(v => v.id));

        const shopifyProduct = await getShopifyProduct(mapping.shopify_product_id);
        const shopifyVariants = (shopifyProduct?.variants || []).map((v: any) => ({
          id: String(v.id),
          sku: v.sku,
          option1: v.option1,
          option2: v.option2,
          inventory_item_id: v.inventory_item_id ? String(v.inventory_item_id) : null,
          inventory_management: v.inventory_management ?? null,
          inventory_quantity: v.inventory_quantity ?? null,
        }));

        const inventoryItemIds = Array.from(
          new Set(shopifyVariants.map((v: any) => v.inventory_item_id).filter(Boolean))
        ) as string[];

        const locations = await getLocations();
        const locationIds = locations.map(l => String(l.id));
        const inventoryLevelsMeaningful = inventoryItemIds.length
          ? await getInventoryLevels(inventoryItemIds, locationIds.slice(0, 10))
          : [];

        // Build local view
        const mappingByVariantId = new Map((localMappings || []).map(m => [m.variant_id, m]));
        const local = (localVariants || []).map(v => {
          const m = mappingByVariantId.get(v.id);
          return {
            variant_id: v.id,
            size: v.size,
            color: v.color,
            stock_qty: v.stock_qty,
            shopify_variant_id: m?.shopify_variant_id ? String(m.shopify_variant_id) : null,
            shopify_inventory_item_id: m?.shopify_inventory_item_id ? String(m.shopify_inventory_item_id) : null,
          };
        });

        result = {
          message: 'Debug inventory snapshot',
          product: {
            product_id: productId,
            shopify_product_id: String(mapping.shopify_product_id),
            shopify_handle: mapping.shopify_product_handle,
          },
          locations: locations.map((l: any) => ({
            id: String(l.id),
            name: l.name,
            active: l.active,
            fulfills_online_orders: l.fulfills_online_orders,
          })),
          local,
          shopifyVariants,
          inventoryLevels: inventoryLevelsMeaningful.map((lvl: any) => ({
            inventory_item_id: String(lvl.inventory_item_id),
            location_id: String(lvl.location_id),
            available: lvl.available,
            updated_at: lvl.updated_at,
          })),
        };

      } else if (action === 'sync_variant_inventory') {
        // Sync single variant inventory (called automatically on stock change)
        if (!variantId || stockQty === undefined) {
          throw new Error('Missing variantId or stockQty');
        }
        
        const syncResult = await syncVariantInventory(variantId, stockQty);
        syncLog.variants_synced = syncResult.synced ? 1 : 0;
        syncLog.sync_type = 'inventory';

        result = syncResult;

      } else if (action === 'delete_product' && productId) {
        // Archive product in Shopify when deleted locally
        const archiveResult = await archiveShopifyProduct(productId);
        syncLog.sync_type = 'delete';
        syncLog.products_synced = archiveResult.archived ? 1 : 0;

        result = { 
          message: archiveResult.archived ? 'Product archived in Shopify' : 'Product not found in Shopify',
          ...archiveResult
        };

      } else if (action === 'cleanup_orphans') {
        // Clean up products that exist in Shopify but not locally
        const cleanupResult = await cleanupOrphans();
        syncLog.sync_type = 'cleanup';
        syncLog.products_synced = cleanupResult.cleaned;
        
        if (cleanupResult.errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = cleanupResult.errors;
        }

        result = { 
          message: `Cleaned up ${cleanupResult.cleaned} orphaned products`,
          ...cleanupResult
        };

      } else if (action === 'archive_shopify_batch') {
        // Archive a batch of non-archived Shopify products (active or draft).
        // Also wipes local mappings for archived products so they can be re-created.
        const { status = 'active', limit = 30 } = body;
        syncLog.sync_type = 'archive_shopify_batch';

        const listResp = await shopifyRequest(
          `/products.json?status=${status}&limit=${Math.min(limit, 50)}&fields=id,title,handle`,
          'GET'
        );
        const items = listResp?.products || [];
        console.log(`[ArchiveBatch] status=${status}, fetched ${items.length}`);

        const errors: any[] = [];
        let archived = 0;

        for (const sp of items) {
          try {
            await shopifyRequest(
              `/products/${sp.id}.json`,
              'PUT',
              { product: { id: sp.id, status: 'archived' } }
            );

            // Find local mapping (if any) and wipe it so re-sync recreates the product.
            const { data: mapping } = await supabase
              .from('shopify_product_mappings')
              .select('product_id')
              .eq('shopify_product_id', String(sp.id))
              .maybeSingle();

            if (mapping?.product_id) {
              const { data: variants } = await supabase
                .from('product_variants')
                .select('id')
                .eq('product_id', mapping.product_id);
              if (variants && variants.length > 0) {
                await supabase
                  .from('shopify_variant_mappings')
                  .delete()
                  .in('variant_id', variants.map(v => v.id));
              }
              await supabase
                .from('shopify_product_mappings')
                .delete()
                .eq('shopify_product_id', String(sp.id));
              // Clear cached Shopify image url so it will be re-fetched on next sync
              await supabase
                .from('products')
                .update({ shopify_image_url: null })
                .eq('id', mapping.product_id);
            }

            archived++;
            await delay(400);
          } catch (err: any) {
            console.error(`[ArchiveBatch] Error for ${sp.id}: ${err.message}`);
            errors.push({ shopifyId: sp.id, title: sp.title, error: err.message });
            await delay(400);
          }
        }

        syncLog.products_synced = archived;
        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }

        result = {
          message: `Archived ${archived} Shopify products (status=${status})`,
          archived,
          fetched: items.length,
          status,
          hasMore: items.length >= Math.min(limit, 50),
          errors,
        };

      } else if (action === 'replicate_with_stock_batch') {
        // Sync a batch of active products that have stock > 0 AND no Shopify mapping yet.
        // Used after archive_shopify_batch to recreate only products that should be live.
        // NOTE: each call recomputes eligibility (mapped products are excluded), so the
        // client should keep invoking this action until hasMore=false; offset is not used.
        const { limit = 15 } = body;
        syncLog.sync_type = 'replicate_with_stock_batch';

        // Get all active products with variants
        const { data: allActive } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            variants:product_variants(*)
          `)
          .eq('active', true)
          .order('name', { ascending: true });

        // Get existing mappings to exclude
        const { data: existingMappings } = await supabase
          .from('shopify_product_mappings')
          .select('product_id');
        const mappedIds = new Set((existingMappings || []).map(m => m.product_id));

        const eligible = (allActive || []).filter((p: any) => {
          if (mappedIds.has(p.id)) return false;
          const totalStock = (p.variants || []).reduce(
            (s: number, v: any) => s + (v.stock_qty || 0),
            0
          );
          return totalStock > 0;
        });

        const totalEligible = eligible.length;
        const slice = eligible.slice(0, limit);

        const results: any[] = [];
        const errors: any[] = [];

        for (let i = 0; i < slice.length; i++) {
          const product = slice[i];
          try {
            console.log(`[Replicate] ${i + 1}/${totalEligible}: ${product.name}`);
            const syncResult = await syncProduct(product);
            results.push({ id: product.id, name: product.name, ...syncResult });
            syncLog.products_synced++;
            syncLog.variants_synced += syncResult.variantCount;
            await delay(700);
          } catch (err: any) {
            console.error(`[Replicate] Error ${product.name}: ${err.message}`);
            errors.push({ productId: product.id, productName: product.name, error: err.message });
            await delay(400);
          }
        }

        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }

        const remaining = Math.max(0, totalEligible - results.length);

        result = {
          message: 'Replicate batch completed',
          processed: results.length,
          totalEligible,
          remainingCount: remaining,
          hasMore: remaining > 0,
          errors,
        };

      } else if (action === 'audit_weights') {
        syncLog.sync_type = 'audit_weights';
        const auditErrors: any[] = [];
        let page = 1;
        let pageInfo: string | null = null;
        let totalChecked = 0;
        const missing: any[] = [];
        let nextUrl: string | null = `${shopifyApiUrl}/products.json?limit=250&fields=id,title,handle,variants`;
        while (nextUrl) {
          const resp = await fetch(nextUrl, {
            headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN!, 'Content-Type': 'application/json' },
          });
          if (!resp.ok) { auditErrors.push({ status: resp.status, body: await resp.text() }); break; }
          const json = await resp.json();
          const products = json.products || [];
          for (const p of products) {
            totalChecked++;
            const variants = p.variants || [];
            const noWeight = variants.filter((v: any) => !v.grams || v.grams === 0);
            if (noWeight.length > 0) {
              missing.push({
                shopify_product_id: String(p.id),
                title: p.title,
                handle: p.handle,
                variants_without_weight: noWeight.length,
                total_variants: variants.length,
              });
            }
          }
          const link = resp.headers.get('link') || '';
          const m = link.match(/<([^>]+)>;\s*rel="next"/);
          nextUrl = m ? m[1] : null;
          page++;
          if (page > 50) break;
          await delay(300);
        }
        result = {
          message: `Audit complete. ${missing.length} of ${totalChecked} products have variants without weight.`,
          totalChecked,
          missingCount: missing.length,
          missing: missing.slice(0, 100),
          errors: auditErrors,
        };
        syncLog.products_synced = totalChecked;
        if (auditErrors.length) syncLog.status = 'partial';

      } else if (action === 'fix_missing_images') {
        // Fetch Shopify CDN URLs for products missing shopify_image_url
        syncLog.sync_type = 'fix_images';
        
        console.log('[FixImages] Starting fix_missing_images action...');
        
        // Get all active products with mappings but missing shopify_image_url
        // Use separate query to get products with null or empty shopify_image_url
        const { data: productsWithMappings, error: queryError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            shopify_image_url,
            shopify_product_mappings!inner(shopify_product_id)
          `)
          .eq('active', true);
        
        if (queryError) {
          console.error('[FixImages] Query error:', queryError);
          throw queryError;
        }
        
        // Filter products missing shopify_image_url
        const productsToFix = (productsWithMappings || []).filter(
          p => !p.shopify_image_url || p.shopify_image_url === ''
        );
        
        console.log(`[FixImages] Found ${productsToFix.length} products to fix`);
        
        const errors: any[] = [];
        let fixed = 0;
        
        for (const product of productsToFix || []) {
          try {
            const shopifyProductId = (product.shopify_product_mappings as any[])?.[0]?.shopify_product_id;
            if (!shopifyProductId) continue;
            
            console.log(`[FixImages] Fetching image for ${product.name} (Shopify ID: ${shopifyProductId})`);
            
            const shopifyProduct = await getShopifyProduct(shopifyProductId);
            const shopifyImages = shopifyProduct?.images || [];
            const shopifyImageUrl = shopifyImages.length > 0 ? shopifyImages[0].src : null;
            
            if (shopifyImageUrl) {
              await supabase
                .from('products')
                .update({ shopify_image_url: shopifyImageUrl })
                .eq('id', product.id);
              
              console.log(`[FixImages] Updated ${product.name}: ${shopifyImageUrl}`);
              fixed++;
            } else {
              console.log(`[FixImages] No image found in Shopify for ${product.name}`);
            }
            
            // Small delay to avoid rate limiting
            await delay(500);
          } catch (err: any) {
            console.error(`[FixImages] Error for ${product.name}: ${err.message}`);
            errors.push({ product_id: product.id, name: product.name, error: err.message });
          }
        }
        
        syncLog.products_synced = fixed;
        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }
        
        result = {
          message: `Fixed ${fixed} of ${productsToFix?.length || 0} products with missing images`,
          fixed,
          total: productsToFix?.length || 0,
          errors,
        };

      } else {
        throw new Error('Invalid action');
      }

    } catch (err: any) {
      syncLog.status = 'error';
      syncLog.errors = [{ error: err.message }];
      throw err;
    } finally {
      // Log the sync
      await supabase.from('shopify_sync_logs').insert(syncLog);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Shopify sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
