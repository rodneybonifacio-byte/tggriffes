import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  productName: string;
  size: string;
  color: string | null;
  quantity: number;
  unitPriceCents: number;
  imageUrl?: string;
}

interface OrderData {
  orderNumber?: number;
  customerName: string;
  customerWhatsapp: string;
  destCep: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingService: string;
  shippingPriceCents: number;
  shippingDeadlineDays: number;
  totalCents: number;
  orderDate: string;
  logoUrl?: string;
  siteUrl?: string;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return cep;
}

async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    console.log("[generate-order-pdf] fetching image:", url);
    const response = await fetch(url, {
      headers: {
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.log("[generate-order-pdf] image fetch failed:", response.status);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    console.log("[generate-order-pdf] image fetched:", { size: bytes.length, contentType });
    
    // Determine type from content-type header or URL
    let type = 'unknown';
    if (contentType.includes('png') || url.toLowerCase().includes('.png')) {
      type = 'png';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg') || url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')) {
      type = 'jpg';
    } else if (contentType.includes('webp') || url.toLowerCase().includes('.webp')) {
      type = 'webp';
    }
    
    return { bytes, type };
  } catch (error) {
    console.log("[generate-order-pdf] image fetch error:", error);
    return null;
  }
}

function resolveUrl(maybeUrl: string | undefined, siteUrl?: string): string | undefined {
  if (!maybeUrl) return undefined;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  if (!siteUrl) return undefined;
  try {
    return new URL(maybeUrl, siteUrl).toString();
  } catch {
    return undefined;
  }
}

async function generatePDF(order: OrderData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Page dimensions - A4 width, dynamic height
  const pageWidth = 595; // A4 width in points
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  
  // Calculate heights
  const headerHeight = 80;
  const customerSectionHeight = 60;
  const itemRowHeight = 70;
  const itemsHeight = order.items.length * itemRowHeight + 40;
  const totalsHeight = 100;
  const footerHeight = 40;
  
  const pageHeight = headerHeight + customerSectionHeight + itemsHeight + totalsHeight + footerHeight + 60;
  
  const page = pdfDoc.addPage([pageWidth, Math.max(500, pageHeight)]);
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const orange = rgb(0.95, 0.6, 0.1);
  
  let y = page.getHeight() - margin;
  
  // ========== HEADER SECTION ==========
  // Logo on the left
  const logoUrl = resolveUrl(order.logoUrl, order.siteUrl);
  let logoEmbedded = false;
  
  if (logoUrl) {
    try {
      const imageData = await fetchImageAsBytes(logoUrl);
      if (imageData && imageData.type === 'png') {
        const logoImage = await pdfDoc.embedPng(imageData.bytes);
        const logoHeight = 45;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        
        page.drawImage(logoImage, {
          x: margin,
          y: y - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        logoEmbedded = true;
      } else if (imageData && imageData.type === 'jpg') {
        const logoImage = await pdfDoc.embedJpg(imageData.bytes);
        const logoHeight = 45;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        
        page.drawImage(logoImage, {
          x: margin,
          y: y - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        logoEmbedded = true;
      }
    } catch (e) {
      console.log("[generate-order-pdf] logo embed error:", e);
    }
  }
  
  if (!logoEmbedded) {
    page.drawText("LOJA ATACADO TG GRIFFES", {
      x: margin,
      y: y - 30,
      size: 18,
      font: fontBold,
      color: black,
    });
  }
  
  // Order number on the right - big and prominent
  const orderLabel = order.orderNumber ? `#${order.orderNumber}` : "";
  if (orderLabel) {
    const labelWidth = fontBold.widthOfTextAtSize(orderLabel, 24);
    page.drawText(orderLabel, {
      x: pageWidth - margin - labelWidth,
      y: y - 25,
      size: 24,
      font: fontBold,
      color: black,
    });
    
    // Date below
    const dateWidth = fontRegular.widthOfTextAtSize(order.orderDate, 10);
    page.drawText(order.orderDate, {
      x: pageWidth - margin - dateWidth,
      y: y - 42,
      size: 10,
      font: fontRegular,
      color: gray,
    });
  }
  
  y -= headerHeight;
  
  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 20;
  
  // ========== CUSTOMER SECTION ==========
  page.drawText("Cliente", { x: margin, y, size: 10, font: fontBold, color: gray });
  y -= 16;
  
  page.drawText(order.customerName, { x: margin, y, size: 12, font: fontBold, color: black });
  y -= 16;
  
  page.drawText(`${formatPhone(order.customerWhatsapp)} • CEP: ${formatCep(order.destCep)}`, {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  
  y -= 25;
  
  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 25;
  
  // ========== ITEMS SECTION ==========
  page.drawText("Itens do Pedido", { x: margin, y, size: 10, font: fontBold, color: gray });
  y -= 20;
  
  for (const item of order.items) {
    const rowStartY = y;
    const imgSize = 50;
    
    // Draw item background
    page.drawRectangle({
      x: margin,
      y: rowStartY - imgSize - 8,
      width: contentWidth,
      height: imgSize + 16,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: lightGray,
      borderWidth: 0.5,
    });
    
    // Try to embed product image
    const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
    let imageEmbedded = false;
    
    if (productImageUrl) {
      try {
        const imageData = await fetchImageAsBytes(productImageUrl);
        if (imageData) {
          let productImage = null;
          
          if (imageData.type === 'png') {
            productImage = await pdfDoc.embedPng(imageData.bytes);
          } else if (imageData.type === 'jpg') {
            productImage = await pdfDoc.embedJpg(imageData.bytes);
          }
          // Note: webp is not supported by pdf-lib
          
          if (productImage) {
            page.drawImage(productImage, {
              x: margin + 8,
              y: rowStartY - imgSize - 4,
              width: imgSize,
              height: imgSize,
            });
            imageEmbedded = true;
          }
        }
      } catch (e) {
        console.log("[generate-order-pdf] product image error:", e);
      }
    }
    
    if (!imageEmbedded) {
      // Draw placeholder with icon-like appearance
      page.drawRectangle({
        x: margin + 8,
        y: rowStartY - imgSize - 4,
        width: imgSize,
        height: imgSize,
        color: rgb(0.92, 0.92, 0.92),
        borderColor: lightGray,
        borderWidth: 1,
      });
      
      // Draw simple "image" text in center
      const placeholderText = "IMG";
      const placeholderWidth = fontRegular.widthOfTextAtSize(placeholderText, 10);
      page.drawText(placeholderText, {
        x: margin + 8 + (imgSize - placeholderWidth) / 2,
        y: rowStartY - imgSize / 2 - 8,
        size: 10,
        font: fontRegular,
        color: gray,
      });
    }
    
    const textX = margin + imgSize + 20;
    
    // Product name
    const productText = item.productName.length > 35 
      ? item.productName.substring(0, 32) + "..." 
      : item.productName;
    
    page.drawText(productText, {
      x: textX,
      y: rowStartY - 18,
      size: 11,
      font: fontBold,
      color: black,
    });
    
    // Size and color info
    const variantText = `${item.color || ''} / ${item.size}`;
    page.drawText(variantText, {
      x: textX,
      y: rowStartY - 34,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    
    // Price, quantity and total on the right side
    const unitPriceText = formatPrice(item.unitPriceCents);
    const qtyText = `× ${item.quantity}`;
    const lineTotalText = formatPrice(item.unitPriceCents * item.quantity);
    
    // Unit price
    page.drawText(unitPriceText, {
      x: pageWidth - margin - 180,
      y: rowStartY - 18,
      size: 10,
      font: fontRegular,
      color: black,
    });
    
    // Quantity
    page.drawText(qtyText, {
      x: pageWidth - margin - 100,
      y: rowStartY - 18,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    
    // Line total (right aligned)
    const lineTotalWidth = fontBold.widthOfTextAtSize(lineTotalText, 11);
    page.drawText(lineTotalText, {
      x: pageWidth - margin - 8 - lineTotalWidth,
      y: rowStartY - 18,
      size: 11,
      font: fontBold,
      color: black,
    });
    
    y = rowStartY - imgSize - 20;
  }
  
  y -= 10;
  
  // Divider before totals
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 25;
  
  // ========== TOTALS SECTION ==========
  const totalsLabelX = pageWidth - margin - 200;
  const totalsValueX = pageWidth - margin - 8;
  
  // Subtotal
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  page.drawText(`Subtotal (${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'})`, {
    x: totalsLabelX,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  const subtotalText = formatPrice(order.subtotalCents);
  const subtotalWidth = fontRegular.widthOfTextAtSize(subtotalText, 10);
  page.drawText(subtotalText, {
    x: totalsValueX - subtotalWidth,
    y,
    size: 10,
    font: fontRegular,
    color: black,
  });
  
  y -= 18;
  
  // Shipping
  const shippingLabel = `Frete (${order.shippingService})`;
  page.drawText(shippingLabel, {
    x: totalsLabelX,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  const shippingText = formatPrice(order.shippingPriceCents);
  const shippingWidth = fontRegular.widthOfTextAtSize(shippingText, 10);
  page.drawText(shippingText, {
    x: totalsValueX - shippingWidth,
    y,
    size: 10,
    font: fontRegular,
    color: black,
  });
  
  y -= 22;
  
  // Total line separator
  page.drawLine({
    start: { x: totalsLabelX, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 1,
    color: black,
  });
  
  // TOTAL
  page.drawText("Total", {
    x: totalsLabelX,
    y,
    size: 14,
    font: fontBold,
    color: black,
  });
  const totalText = formatPrice(order.totalCents);
  const totalWidth = fontBold.widthOfTextAtSize(totalText, 14);
  page.drawText(totalText, {
    x: totalsValueX - totalWidth,
    y,
    size: 14,
    font: fontBold,
    color: black,
  });
  
  y -= 40;
  
  // ========== FOOTER ==========
  const footerText = "Loja Atacado TG Griffes • Streetwear Premium";
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 9);
  page.drawText(footerText, {
    x: (pageWidth - footerWidth) / 2,
    y: margin,
    size: 9,
    font: fontRegular,
    color: gray,
  });
  
  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const orderData: OrderData = await req.json();

    console.log("[generate-order-pdf] start", {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      items: orderData.items?.length ?? 0,
      siteUrl: orderData.siteUrl,
      logoUrl: orderData.logoUrl,
    });
    
    // Log each item's image URL for debugging
    orderData.items?.forEach((item, idx) => {
      console.log(`[generate-order-pdf] item ${idx}:`, {
        name: item.productName,
        imageUrl: item.imageUrl,
      });
    });

    const pdfBytes = await generatePDF(orderData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderNum = orderData.orderNumber || Date.now();
    const filePath = `pedido-${orderNum}.pdf`;

    console.log("[generate-order-pdf] uploading PDF", { bucket: "order-pdfs", filePath, size: pdfBytes.length });

    const { error: uploadError } = await supabase.storage
      .from("order-pdfs")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-order-pdf] uploadError", uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("order-pdfs").getPublicUrl(filePath);

    const pdfUrl = urlData.publicUrl;

    console.log("[generate-order-pdf] done", { pdfUrl });

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl,
        orderNumber: orderData.orderNumber,
        message: "PDF generated successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-order-pdf] fatal", errorMessage);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
