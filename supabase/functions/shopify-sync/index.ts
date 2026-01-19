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
    
    const { action, productId } = await req.json();

    // Shopify API base URL - ensure no trailing slashes or extra chars
    const cleanDomain = SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const shopifyApiUrl = `https://${cleanDomain}/admin/api/2024-01`;

    console.log(`Using Shopify API URL: ${shopifyApiUrl}`);

    // Helper function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Get location ID for inventory updates
    async function getLocationId(): Promise<string> {
      const { locations } = await shopifyRequest('/locations.json');
      if (!locations || locations.length === 0) {
        throw new Error('No Shopify locations found');
      }
      return locations[0].id.toString();
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
      if (product.main_image_url) {
        shopifyProduct.images = [{ src: product.main_image_url }];
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

        // Update mapping
        await supabase
          .from('shopify_product_mappings')
          .update({ 
            last_synced_at: new Date().toISOString(),
            shopify_product_handle: shopifyHandle 
          })
          .eq('id', existingMapping.id);

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

        // Save mapping
        await supabase
          .from('shopify_product_mappings')
          .insert({
            product_id: product.id,
            shopify_product_id: shopifyProductId,
            shopify_product_handle: shopifyHandle,
          });
      }

      // Map variants
      for (let i = 0; i < variants.length; i++) {
        const localVariant = variants[i];
        const shopifyVariant = createdVariants[i];
        
        if (shopifyVariant) {
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
                shopify_variant_id: shopifyVariant.id.toString(),
                shopify_inventory_item_id: shopifyVariant.inventory_item_id?.toString() || null,
              });
          } else {
            await supabase
              .from('shopify_variant_mappings')
              .update({ 
                last_synced_at: new Date().toISOString(),
                shopify_inventory_item_id: shopifyVariant.inventory_item_id?.toString() || null,
              })
              .eq('id', existingVarMapping.id);
          }
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

    let result: any;
    let syncLog: any = {
      sync_type: action,
      status: 'success',
      products_synced: 0,
      variants_synced: 0,
      errors: null,
    };

    try {
      if (action === 'sync_all' || action === 'sync_pending') {
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
        // Sync all inventory
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, stock_qty');

        const results = [];
        const errors = [];

        for (const variant of variants || []) {
          try {
            const syncResult = await syncVariantInventory(variant.id, variant.stock_qty);
            if (syncResult.synced) {
              results.push(syncResult);
              syncLog.variants_synced++;
            }
          } catch (err: any) {
            errors.push({ variantId: variant.id, error: err.message });
          }
        }

        if (errors.length > 0) {
          syncLog.status = 'partial';
          syncLog.errors = errors;
        }

        result = { 
          message: 'Inventory sync completed', 
          variantsSynced: results.length,
          errors 
        };

      } else if (action === 'sync_variant_inventory') {
        // Sync single variant inventory (called automatically on stock change)
        const body = await req.clone().json();
        const { variantId, stockQty } = body;
        
        if (!variantId || stockQty === undefined) {
          throw new Error('Missing variantId or stockQty');
        }
        
        const syncResult = await syncVariantInventory(variantId, stockQty);
        syncLog.variants_synced = syncResult.synced ? 1 : 0;
        syncLog.sync_type = 'inventory';

        result = syncResult;

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
