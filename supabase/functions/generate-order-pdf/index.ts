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

async function fetchImage(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
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
  
  // Calculate page height based on items (compact)
  const headerHeight = 60;
  const customerHeight = 50;
  const itemHeight = 45; // Each item row height
  const totalsHeight = 70;
  const footerHeight = 30;
  const margin = 30;
  
  const contentHeight = headerHeight + customerHeight + (order.items.length * itemHeight) + totalsHeight + footerHeight + 40;
  const pageHeight = Math.max(400, contentHeight);
  const pageWidth = 400; // Compact width
  
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.95, 0.95, 0.95);
  
  let y = pageHeight - margin;
  
  // White header with logo
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
  });
  
  // Try to embed logo
  const logoUrl = resolveUrl(order.logoUrl, order.siteUrl);
  let logoEmbedded = false;
  
  if (logoUrl) {
    try {
      const logoBytes = await fetchImage(logoUrl);
      if (logoBytes) {
        let logoImage;
        if (logoUrl.toLowerCase().includes('.png')) {
          logoImage = await pdfDoc.embedPng(logoBytes);
        } else {
          logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        
        const logoHeight = 35;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        
        page.drawImage(logoImage, {
          x: margin,
          y: pageHeight - margin - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        logoEmbedded = true;
      }
    } catch (e) {
      console.log("Could not embed logo:", e);
    }
  }
  
  if (!logoEmbedded) {
    page.drawText("TG GRIFFES", {
      x: margin,
      y: pageHeight - margin - 20,
      size: 18,
      font: fontBold,
      color: black,
    });
  }
  
  // Order number on the right
  const orderLabel = order.orderNumber ? `#${order.orderNumber}` : "";
  if (orderLabel) {
    const labelWidth = fontBold.widthOfTextAtSize(orderLabel, 16);
    page.drawText(orderLabel, {
      x: pageWidth - margin - labelWidth,
      y: pageHeight - margin - 20,
      size: 16,
      font: fontBold,
      color: black,
    });
  }
  
  // Date below order number
  const dateWidth = fontRegular.widthOfTextAtSize(order.orderDate, 10);
  page.drawText(order.orderDate, {
    x: pageWidth - margin - dateWidth,
    y: pageHeight - margin - 35,
    size: 10,
    font: fontRegular,
    color: gray,
  });
  
  // Divider line
  y = pageHeight - headerHeight;
  page.drawLine({
    start: { x: 0, y },
    end: { x: pageWidth, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 15;
  
  // Customer info (compact, single line)
  page.drawText(`${order.customerName} • ${formatPhone(order.customerWhatsapp)} • CEP: ${formatCep(order.destCep)}`, {
    x: margin,
    y,
    size: 9,
    font: fontRegular,
    color: gray,
  });
  
  y -= 25;
  
  // Divider
  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: pageWidth - margin, y: y + 10 },
    thickness: 0.5,
    color: lightGray,
  });
  
  // Items with images
  for (const item of order.items) {
    const rowY = y;
    const imgSize = 35;
    let imgX = margin;
    
    // Try to embed product image
    const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
    let imageEmbedded = false;
    
    if (productImageUrl) {
      try {
        const imgBytes = await fetchImage(productImageUrl);
        if (imgBytes) {
          let productImage;
          if (productImageUrl.toLowerCase().includes('.png')) {
            productImage = await pdfDoc.embedPng(imgBytes);
          } else if (productImageUrl.toLowerCase().includes('.webp')) {
            // webp not supported, draw placeholder
          } else {
            productImage = await pdfDoc.embedJpg(imgBytes);
          }
          
          if (productImage) {
            page.drawImage(productImage, {
              x: imgX,
              y: rowY - imgSize,
              width: imgSize,
              height: imgSize,
            });
            imageEmbedded = true;
          }
        }
      } catch (e) {
        console.log("Could not embed product image:", e);
      }
    }
    
    if (!imageEmbedded) {
      // Draw placeholder box
      page.drawRectangle({
        x: imgX,
        y: rowY - imgSize,
        width: imgSize,
        height: imgSize,
        color: lightGray,
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
      });
    }
    
    const textX = imgX + imgSize + 10;
    
    // Product name (truncated)
    const productText = item.productName.length > 25 
      ? item.productName.substring(0, 22) + "..." 
      : item.productName;
    
    page.drawText(productText, {
      x: textX,
      y: rowY - 12,
      size: 10,
      font: fontBold,
      color: black,
    });
    
    // Size and color
    const sizeColor = `${item.size}${item.color ? ` • ${item.color}` : ""}`;
    page.drawText(sizeColor, {
      x: textX,
      y: rowY - 24,
      size: 9,
      font: fontRegular,
      color: gray,
    });
    
    // Quantity and price on the right
    const qtyText = `${item.quantity}x`;
    const priceText = formatPrice(item.unitPriceCents * item.quantity);
    
    page.drawText(qtyText, {
      x: pageWidth - margin - 80,
      y: rowY - 12,
      size: 10,
      font: fontBold,
      color: black,
    });
    
    const priceWidth = fontBold.widthOfTextAtSize(priceText, 10);
    page.drawText(priceText, {
      x: pageWidth - margin - priceWidth,
      y: rowY - 12,
      size: 10,
      font: fontBold,
      color: black,
    });
    
    y -= itemHeight;
    
    // Separator line
    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: pageWidth - margin, y: y + 5 },
      thickness: 0.5,
      color: lightGray,
    });
  }
  
  y -= 10;
  
  // Totals section (compact)
  const totalsX = pageWidth - margin - 150;
  
  // Subtotal
  page.drawText("Subtotal:", { x: totalsX, y, size: 9, font: fontRegular, color: gray });
  const subtotalText = formatPrice(order.subtotalCents);
  const subtotalWidth = fontRegular.widthOfTextAtSize(subtotalText, 9);
  page.drawText(subtotalText, { x: pageWidth - margin - subtotalWidth, y, size: 9, font: fontRegular, color: black });
  
  y -= 14;
  
  // Shipping
  const shippingLabel = `Frete (${order.shippingService}):`;
  page.drawText(shippingLabel, { x: totalsX, y, size: 9, font: fontRegular, color: gray });
  const shippingText = formatPrice(order.shippingPriceCents);
  const shippingWidth = fontRegular.widthOfTextAtSize(shippingText, 9);
  page.drawText(shippingText, { x: pageWidth - margin - shippingWidth, y, size: 9, font: fontRegular, color: black });
  
  y -= 18;
  
  // Total line
  page.drawLine({
    start: { x: totalsX, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 1,
    color: black,
  });
  
  // Total
  page.drawText("TOTAL:", { x: totalsX, y, size: 12, font: fontBold, color: black });
  const totalText = formatPrice(order.totalCents);
  const totalWidth = fontBold.widthOfTextAtSize(totalText, 12);
  page.drawText(totalText, { x: pageWidth - margin - totalWidth, y, size: 12, font: fontBold, color: black });
  
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
