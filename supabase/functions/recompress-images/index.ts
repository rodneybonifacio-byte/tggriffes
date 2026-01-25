import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { offset = 0 } = await req.json().catch(() => ({}));
    const BATCH_SIZE = 100;

    // List files
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("product-images")
      .list("products", {
        limit: BATCH_SIZE,
        offset: offset,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Listagem concluída",
          files: [],
          offset: offset,
          complete: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return file info for client-side processing
    const fileList = files
      .filter(f => f.name && f.metadata)
      .map(f => ({
        name: f.name,
        path: `products/${f.name}`,
        size: f.metadata?.size || 0,
        sizeKB: Math.round((f.metadata?.size || 0) / 1024),
        type: f.metadata?.mimetype || "unknown",
      }));

    const totalSizeKB = fileList.reduce((sum, f) => sum + f.sizeKB, 0);
    const largeFiles = fileList.filter(f => f.sizeKB > 100);

    return new Response(
      JSON.stringify({
        success: true,
        offset: offset,
        nextOffset: offset + files.length,
        hasMore: files.length === BATCH_SIZE,
        totalFiles: fileList.length,
        totalSizeKB,
        largeFilesCount: largeFiles.length,
        largeFilesSizeKB: largeFiles.reduce((sum, f) => sum + f.sizeKB, 0),
        files: fileList,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
