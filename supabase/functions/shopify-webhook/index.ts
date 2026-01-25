import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-requested-with, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ShopifyItem {
  product_id: string; // GID format: gid://shopify/Product/123
  variant_id: string; // GID format: gid://shopify/ProductVariant/456
  sku: string;
  name: string;
  quantity: number;
  price: string;
}

interface ShopifyWebhookPayload {
  order_id: string;
  order_number: string; // e.g., "#3094"
  customer_email: string;
  total: string;
  currency: string;
  items: ShopifyItem[];
  // Standard Shopify fields (may not be present in custom webhooks)
  financial_status?: string;
  line_items?: ShopifyItem[];
}

// Extract numeric ID from GID format
function extractIdFromGid(gid: string): string {
  // gid://shopify/ProductVariant/48748410994928 -> 48748410994928
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : gid;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    
    console.log(`Webhook received: topic=${topic}, domain=${shopDomain}`);

    // Parse body
    const rawBody = await req.text();
    console.log(`Raw body (first 800 chars): ${rawBody.substring(0, 800)}`);
    
    let payload: ShopifyWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Failed to parse JSON body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order number (remove # if present)
    const orderNum = (payload.order_number || "unknown").replace('#', '');
    
    // Get items - try both "items" (custom webhook) and "line_items" (standard Shopify)
    const items = payload.items || payload.line_items || [];
    
    console.log(`Order #${orderNum} - items count: ${items.length}, email: ${payload.customer_email}`);

    if (!items || items.length === 0) {
      console.log(`Order #${orderNum} has no items`);
      return new Response(JSON.stringify({ message: "No items to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if movements already exist for this order (idempotency)
    const { data: existingMovements } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("reason", `Venda Shopify #${orderNum}`)
      .limit(1);

    if (existingMovements && existingMovements.length > 0) {
      console.log(`Order #${orderNum} already processed - skipping`);
      return new Response(JSON.stringify({ 
        message: "Order already processed",
        order_number: orderNum 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { variant: string; decremented: number; success: boolean; error?: string }[] = [];

    for (const item of items) {
      // Extract numeric variant ID from GID if needed
      const rawVariantId = item.variant_id;
      const shopifyVariantId = extractIdFromGid(rawVariantId);
      
      console.log(`Processing item: ${item.name}, variant_id: ${rawVariantId} -> ${shopifyVariantId}, qty: ${item.quantity}`);
      
      // Find local variant by Shopify mapping
      const { data: mapping, error: mappingError } = await supabase
        .from("shopify_variant_mappings")
        .select("variant_id")
        .eq("shopify_variant_id", shopifyVariantId)
        .maybeSingle();

      if (mappingError) {
        console.error(`Error finding mapping for Shopify variant ${shopifyVariantId}:`, mappingError);
        results.push({
          variant: item.name,
          decremented: 0,
          success: false,
          error: mappingError.message,
        });
        continue;
      }

      if (!mapping) {
        console.warn(`No local mapping found for Shopify variant ${shopifyVariantId} (${item.name})`);
        results.push({
          variant: item.name,
          decremented: 0,
          success: false,
          error: "No local mapping found",
        });
        continue;
      }

      // Get current stock
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id, stock_qty, product_id")
        .eq("id", mapping.variant_id)
        .single();

      if (variantError || !variant) {
        console.error(`Error fetching variant ${mapping.variant_id}:`, variantError);
        results.push({
          variant: item.name,
          decremented: 0,
          success: false,
          error: variantError?.message || "Variant not found",
        });
        continue;
      }

      const newStock = Math.max(0, variant.stock_qty - item.quantity);

      // Update stock
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ stock_qty: newStock })
        .eq("id", mapping.variant_id);

      if (updateError) {
        console.error(`Error updating stock for variant ${mapping.variant_id}:`, updateError);
        results.push({
          variant: item.name,
          decremented: 0,
          success: false,
          error: updateError.message,
        });
        continue;
      }

      // Log movement
      await supabase.from("stock_movements").insert({
        variant_id: mapping.variant_id,
        product_id: variant.product_id,
        quantity: -item.quantity,
        stock_before: variant.stock_qty,
        stock_after: newStock,
        movement_type: "shopify_sale",
        reason: `Venda Shopify #${orderNum}`,
      });

      console.log(`✓ Decremented ${item.quantity} from variant ${mapping.variant_id}. Stock: ${variant.stock_qty} -> ${newStock}`);
      
      results.push({
        variant: item.name,
        decremented: item.quantity,
        success: true,
      });
    }

    // Log sync
    await supabase.from("shopify_sync_logs").insert({
      sync_type: "webhook_order",
      status: results.every(r => r.success) ? "success" : (results.some(r => r.success) ? "partial" : "failed"),
      variants_synced: results.filter(r => r.success).length,
      errors: results.filter(r => !r.success).map(r => ({ ...r, order_number: orderNum })),
    });

    console.log(`Order #${orderNum} completed: ${results.filter(r => r.success).length} success, ${results.filter(r => !r.success).length} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        order_number: orderNum,
        items_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
