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
  name: string; // e.g., "#3094"
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
    
    console.log(`Webhook received: topic=${topic}, domain=${shopDomain}`);

    // Parse body
    const rawBody = await req.text();
    console.log(`Raw body (first 500 chars): ${rawBody.substring(0, 500)}`);
    
    let order: ShopifyOrder;
    try {
      order = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Failed to parse JSON body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log all relevant fields
    const orderNum = order.order_number || order.name?.replace('#', '') || 'unknown';
    const financialStatus = order.financial_status;
    
    console.log(`Order #${orderNum} - financial_status: "${financialStatus}", has line_items: ${!!order.line_items}, items count: ${order.line_items?.length || 0}`);

    // Accept webhook if:
    // 1. Topic is orders/paid OR
    // 2. Topic is null/missing but financial_status is "paid" (flexible mode)
    // 3. Also accept if financial_status is missing but topic is orders/paid
    const isPaidTopic = topic === "orders/paid";
    const isPaidStatus = financialStatus === "paid";
    
    // If topic is explicitly something else (not null, not orders/paid), ignore
    if (topic !== null && !isPaidTopic) {
      console.log(`Ignoring topic: ${topic} - only orders/paid triggers stock decrement`);
      return new Response(JSON.stringify({ message: "Ignored - topic not orders/paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If financial_status is present and not "paid", ignore
    // But if financial_status is missing/undefined, we'll process it (assume it's from orders/paid event)
    if (financialStatus !== undefined && financialStatus !== null && !isPaidStatus) {
      console.log(`Ignoring order #${orderNum} - financial_status is "${financialStatus}", not "paid"`);
      return new Response(JSON.stringify({ message: "Ignored - order not paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have no topic and no financial_status, we can't determine if it's paid
    // Let's be permissive and process it anyway (user explicitly sent it)
    console.log(`Processing Shopify order #${orderNum} with ${order.line_items?.length || 0} items (financial_status: ${financialStatus || 'not provided'})`);

    if (!order.line_items || order.line_items.length === 0) {
      console.log(`Order #${orderNum} has no line items`);
      return new Response(JSON.stringify({ message: "No line items to process" }), {
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
        reason: `Venda Shopify #${orderNum}`,
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
      status: results.every(r => r.success) ? "success" : (results.some(r => r.success) ? "partial" : "failed"),
      variants_synced: results.filter(r => r.success).length,
      errors: results.filter(r => !r.success).map(r => ({ ...r, order_number: orderNum })),
    });

    console.log(`Order #${orderNum} processed: ${results.filter(r => r.success).length} success, ${results.filter(r => !r.success).length} failed`);

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
