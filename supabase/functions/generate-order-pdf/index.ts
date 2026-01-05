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

// Convert webp images to JPEG using wsrv.nl proxy
function getConvertedImageUrl(url: string): string {
  // If it's a webp, convert to JPEG using wsrv.nl
  if (url.toLowerCase().includes('.webp')) {
    // wsrv.nl is a free image CDN that can convert formats
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=85`;
  }
  return url;
}

async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    // Convert webp to JPEG if needed
    const convertedUrl = getConvertedImageUrl(url);
    console.log("[generate-order-pdf] fetching image:", convertedUrl);
    
    const response = await fetch(convertedUrl, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; PDFGenerator/1.0)',
      },
    });
    
    if (!response.ok) {
      console.log("[generate-order-pdf] image fetch failed:", response.status, await response.text().catch(() => ''));
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    console.log("[generate-order-pdf] image fetched:", { size: bytes.length, contentType, convertedUrl });
    
    // Determine type from content-type header or URL
    let type = 'unknown';
    if (contentType.includes('png') || convertedUrl.toLowerCase().includes('.png')) {
      type = 'png';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg') || 
               convertedUrl.toLowerCase().includes('.jpg') || convertedUrl.toLowerCase().includes('.jpeg') ||
               convertedUrl.includes('output=jpg')) {
      type = 'jpg';
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
  
  // A4 dimensions in points (595 x 842)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.88, 0.88, 0.88);
  
  let y = pageHeight - margin;
  
  // ========== HEADER SECTION ==========
  // Logo on the left
  const logoUrl = resolveUrl(order.logoUrl, order.siteUrl);
  let logoEmbedded = false;
  
  if (logoUrl) {
    try {
      const imageData = await fetchImageAsBytes(logoUrl);
      if (imageData && (imageData.type === 'png' || imageData.type === 'jpg')) {
        const logoImage = imageData.type === 'png' 
          ? await pdfDoc.embedPng(imageData.bytes)
          : await pdfDoc.embedJpg(imageData.bytes);
        
        const logoHeight = 50;
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
      y: y - 35,
      size: 20,
      font: fontBold,
      color: black,
    });
  }
  
  // Order number on the right - big and prominent
  const orderLabel = order.orderNumber ? `Pedido #${order.orderNumber}` : "";
  if (orderLabel) {
    const labelWidth = fontBold.widthOfTextAtSize(orderLabel, 18);
    page.drawText(orderLabel, {
      x: pageWidth - margin - labelWidth,
      y: y - 25,
      size: 18,
      font: fontBold,
      color: black,
    });
    
    // Date below
    const dateWidth = fontRegular.widthOfTextAtSize(order.orderDate, 11);
    page.drawText(order.orderDate, {
      x: pageWidth - margin - dateWidth,
      y: y - 45,
      size: 11,
      font: fontRegular,
      color: gray,
    });
  }
  
  y -= 80;
  
  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 30;
  
  // ========== CUSTOMER SECTION ==========
  page.drawText("CLIENTE", { x: margin, y, size: 10, font: fontBold, color: gray });
  y -= 20;
  
  page.drawText(order.customerName, { x: margin, y, size: 14, font: fontBold, color: black });
  y -= 20;
  
  page.drawText(`WhatsApp: ${formatPhone(order.customerWhatsapp)}`, {
    x: margin,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  });
  
  page.drawText(`CEP: ${formatCep(order.destCep)}`, {
    x: margin + 200,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  });
  
  y -= 30;
  
  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 30;
  
  // ========== ITEMS SECTION ==========
  page.drawText("ITENS DO PEDIDO", { x: margin, y, size: 10, font: fontBold, color: gray });
  y -= 25;
  
  for (const item of order.items) {
    const rowStartY = y;
    const imgSize = 60;
    
    // Draw item background
    page.drawRectangle({
      x: margin,
      y: rowStartY - imgSize - 10,
      width: contentWidth,
      height: imgSize + 20,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: lightGray,
      borderWidth: 0.5,
    });
    
    // Try to embed product image
    const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
    let imageEmbedded = false;
    
    if (productImageUrl) {
      try {
        const imageData = await fetchImageAsBytes(productImageUrl);
        if (imageData && (imageData.type === 'png' || imageData.type === 'jpg')) {
          const productImage = imageData.type === 'png'
            ? await pdfDoc.embedPng(imageData.bytes)
            : await pdfDoc.embedJpg(imageData.bytes);
          
          page.drawImage(productImage, {
            x: margin + 10,
            y: rowStartY - imgSize - 5,
            width: imgSize,
            height: imgSize,
          });
          imageEmbedded = true;
          console.log("[generate-order-pdf] product image embedded successfully");
        }
      } catch (e) {
        console.log("[generate-order-pdf] product image error:", e);
      }
    }
    
    if (!imageEmbedded) {
      // Draw placeholder
      page.drawRectangle({
        x: margin + 10,
        y: rowStartY - imgSize - 5,
        width: imgSize,
        height: imgSize,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: lightGray,
        borderWidth: 1,
      });
      
      const placeholderText = "SEM";
      const placeholderWidth = fontRegular.widthOfTextAtSize(placeholderText, 10);
      page.drawText(placeholderText, {
        x: margin + 10 + (imgSize - placeholderWidth) / 2,
        y: rowStartY - imgSize / 2 - 2,
        size: 10,
        font: fontRegular,
        color: gray,
      });
      
      const placeholderText2 = "FOTO";
      const placeholderWidth2 = fontRegular.widthOfTextAtSize(placeholderText2, 10);
      page.drawText(placeholderText2, {
        x: margin + 10 + (imgSize - placeholderWidth2) / 2,
        y: rowStartY - imgSize / 2 - 15,
        size: 10,
        font: fontRegular,
        color: gray,
      });
    }
    
    const textX = margin + imgSize + 25;
    
    // Product name
    const productText = item.productName.length > 40 
      ? item.productName.substring(0, 37) + "..." 
      : item.productName;
    
    page.drawText(productText, {
      x: textX,
      y: rowStartY - 22,
      size: 12,
      font: fontBold,
      color: black,
    });
    
    // Size and color info
    const colorText = item.color || '-';
    const variantText = `Cor: ${colorText} | Tamanho: ${item.size}`;
    page.drawText(variantText, {
      x: textX,
      y: rowStartY - 40,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    
    // Price, quantity and total on the right side
    const unitPriceText = formatPrice(item.unitPriceCents);
    const qtyText = `×${item.quantity}`;
    const lineTotalText = formatPrice(item.unitPriceCents * item.quantity);
    
    // Layout: Unit Price × Qty = Total
    const priceLayout = `${unitPriceText}  ${qtyText}`;
    page.drawText(priceLayout, {
      x: textX,
      y: rowStartY - 58,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    
    // Line total (right aligned, prominent)
    const lineTotalWidth = fontBold.widthOfTextAtSize(lineTotalText, 13);
    page.drawText(lineTotalText, {
      x: pageWidth - margin - 15 - lineTotalWidth,
      y: rowStartY - 35,
      size: 13,
      font: fontBold,
      color: black,
    });
    
    y = rowStartY - imgSize - 25;
  }
  
  y -= 15;
  
  // Divider before totals
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 30;
  
  // ========== TOTALS SECTION ==========
  const totalsLabelX = pageWidth - margin - 220;
  const totalsValueX = pageWidth - margin - 10;
  
  // Subtotal
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  page.drawText(`Subtotal (${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'})`, {
    x: totalsLabelX,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  });
  const subtotalText = formatPrice(order.subtotalCents);
  const subtotalWidth = fontRegular.widthOfTextAtSize(subtotalText, 11);
  page.drawText(subtotalText, {
    x: totalsValueX - subtotalWidth,
    y,
    size: 11,
    font: fontRegular,
    color: black,
  });
  
  y -= 22;
  
  // Shipping
  const shippingLabel = `Frete (${order.shippingService})`;
  page.drawText(shippingLabel, {
    x: totalsLabelX,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  });
  const shippingText = formatPrice(order.shippingPriceCents);
  const shippingWidth = fontRegular.widthOfTextAtSize(shippingText, 11);
  page.drawText(shippingText, {
    x: totalsValueX - shippingWidth,
    y,
    size: 11,
    font: fontRegular,
    color: black,
  });
  
  y -= 28;
  
  // Total line separator
  page.drawLine({
    start: { x: totalsLabelX, y: y + 10 },
    end: { x: pageWidth - margin, y: y + 10 },
    thickness: 2,
    color: black,
  });
  
  // TOTAL
  page.drawText("TOTAL", {
    x: totalsLabelX,
    y,
    size: 16,
    font: fontBold,
    color: black,
  });
  const totalText = formatPrice(order.totalCents);
  const totalWidth = fontBold.widthOfTextAtSize(totalText, 16);
  page.drawText(totalText, {
    x: totalsValueX - totalWidth,
    y,
    size: 16,
    font: fontBold,
    color: black,
  });
  
  // ========== FOOTER ==========
  const footerY = margin + 20;
  const footerText = "Loja Atacado TG Griffes • Streetwear Premium";
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 10);
  page.drawText(footerText, {
    x: (pageWidth - footerWidth) / 2,
    y: footerY,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  
  // Decorative line above footer
  page.drawLine({
    start: { x: margin + 100, y: footerY + 20 },
    end: { x: pageWidth - margin - 100, y: footerY + 20 },
    thickness: 0.5,
    color: lightGray,
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
