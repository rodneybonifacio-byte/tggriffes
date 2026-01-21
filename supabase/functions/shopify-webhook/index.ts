import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-requested-with, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ShopifyLineItem {
  variant_id: number;
  quantity: number;
  sku: string;
  title: string;
  variant_title: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  line_items: ShopifyLineItem[];
  financial_status: string;
  fulfillment_status: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    
    console.log(`Webhook received: ${topic} from ${shopDomain}`);

    // Only process order paid events
    if (topic !== "orders/paid") {
      console.log(`Ignoring topic: ${topic} - only orders/paid triggers stock decrement`);
      return new Response(JSON.stringify({ message: "Ignored - only paid orders decrement stock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const order: ShopifyOrder = await req.json();
    
    // Double-check financial status is paid
    if (order.financial_status !== "paid") {
      console.log(`Ignoring order #${order.order_number} - financial_status is "${order.financial_status}", not "paid"`);
      return new Response(JSON.stringify({ message: "Ignored - order not paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing PAID Shopify order #${order.order_number} with ${order.line_items.length} items`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { variant: string; decremented: number; success: boolean; error?: string }[] = [];

    for (const item of order.line_items) {
      const shopifyVariantId = String(item.variant_id);
      
      // Find local variant by Shopify mapping
      const { data: mapping, error: mappingError } = await supabase
        .from("shopify_variant_mappings")
        .select("variant_id")
        .eq("shopify_variant_id", shopifyVariantId)
        .maybeSingle();

      if (mappingError) {
        console.error(`Error finding mapping for Shopify variant ${shopifyVariantId}:`, mappingError);
        results.push({
          variant: `${item.title} - ${item.variant_title}`,
          decremented: 0,
          success: false,
          error: mappingError.message,
        });
        continue;
      }

      if (!mapping) {
        console.warn(`No local mapping found for Shopify variant ${shopifyVariantId} (${item.title} - ${item.variant_title})`);
        results.push({
          variant: `${item.title} - ${item.variant_title}`,
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
          variant: `${item.title} - ${item.variant_title}`,
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
          variant: `${item.title} - ${item.variant_title}`,
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
        reason: `Venda Shopify #${order.order_number}`,
      });

      console.log(`Decremented ${item.quantity} from variant ${mapping.variant_id}. Stock: ${variant.stock_qty} -> ${newStock}`);
      
      results.push({
        variant: `${item.title} - ${item.variant_title}`,
        decremented: item.quantity,
        success: true,
      });
    }

    // Log sync
    await supabase.from("shopify_sync_logs").insert({
      sync_type: "webhook_order",
      status: results.every(r => r.success) ? "success" : "partial",
      variants_synced: results.filter(r => r.success).length,
      errors: results.filter(r => !r.success),
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_number: order.order_number,
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
