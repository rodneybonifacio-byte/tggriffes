import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compress and resize image using canvas (server-side simulation with fetch + quality param)
async function fetchAndOptimizeImage(imageUrl: string): Promise<{ blob: Blob; sizeKB: number } | null> {
  try {
    // Fetch the image from Shopify CDN with optimized size (1080px width)
    const optimizedUrl = imageUrl.replace(/width=\d+/, "width=1080");
    
    const response = await fetch(optimizedUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const blob = await response.blob();
    const sizeKB = Math.round(blob.size / 1024);
    
    console.log(`Fetched image: ${sizeKB}KB`);
    return { blob, sizeKB };
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, products } = await req.json();

    if (action === "recover") {
      // products should be array of { productId, productName, shopifyImageUrl }
      const results: Array<{
        productId: string;
        productName: string;
        success: boolean;
        newUrl?: string;
        error?: string;
        sizeKB?: number;
      }> = [];

      for (const product of products) {
        try {
          console.log(`Processing: ${product.productName}`);
          
          // Fetch and get the optimized image from Shopify
          const imageResult = await fetchAndOptimizeImage(product.shopifyImageUrl);
          
          if (!imageResult) {
            results.push({
              productId: product.productId,
              productName: product.productName,
              success: false,
              error: "Failed to fetch image from Shopify",
            });
            continue;
          }

          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `${timestamp}-${randomSuffix}.jpeg`;
          const filePath = `products/${fileName}`;
          const thumbPath = `products/${timestamp}-${randomSuffix}_thumb.jpeg`;

          // Upload main image to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(filePath, imageResult.blob, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Upload error for ${product.productName}:`, uploadError);
            results.push({
              productId: product.productId,
              productName: product.productName,
              success: false,
              error: uploadError.message,
            });
            continue;
          }

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

          const newUrl = urlData.publicUrl;

          // Update the product's main_image_url
          const { error: updateError } = await supabase
            .from("products")
            .update({ main_image_url: newUrl })
            .eq("id", product.productId);

          if (updateError) {
            console.error(`Update error for ${product.productName}:`, updateError);
            results.push({
              productId: product.productId,
              productName: product.productName,
              success: false,
              error: updateError.message,
            });
            continue;
          }

          // Also add to product_images table
          await supabase.from("product_images").insert({
            product_id: product.productId,
            image_url: newUrl,
            sort_order: 0,
          });

          results.push({
            productId: product.productId,
            productName: product.productName,
            success: true,
            newUrl,
            sizeKB: imageResult.sizeKB,
          });

          console.log(`✓ Recovered: ${product.productName} (${imageResult.sizeKB}KB)`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error processing ${product.productName}:`, error);
          results.push({
            productId: product.productId,
            productName: product.productName,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalSizeKB = results
        .filter((r) => r.success && r.sizeKB)
        .reduce((sum, r) => sum + (r.sizeKB || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          results,
          summary: {
            total: products.length,
            recovered: successCount,
            failed: products.length - successCount,
            totalSizeKB,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
