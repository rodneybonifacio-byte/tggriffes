import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

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
  skipShipping?: boolean;
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
  if (url.toLowerCase().includes('.webp')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=85`;
  }
  return url;
}

async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
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

// Constants for layout
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const ITEM_HEIGHT = 90; // Height of each item row
const FOOTER_HEIGHT = 60;

async function generatePDF(order: OrderData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.88, 0.88, 0.88);
  
  // Pre-fetch logo image
  let logoImage: any = null;
  const logoUrl = resolveUrl(order.logoUrl, order.siteUrl);
  if (logoUrl) {
    try {
      const imageData = await fetchImageAsBytes(logoUrl);
      if (imageData && (imageData.type === 'png' || imageData.type === 'jpg')) {
        logoImage = imageData.type === 'png' 
          ? await pdfDoc.embedPng(imageData.bytes)
          : await pdfDoc.embedJpg(imageData.bytes);
      }
    } catch (e) {
      console.log("[generate-order-pdf] logo embed error:", e);
    }
  }
  
  // Pre-fetch all product images
  const productImages: Map<string, any> = new Map();
  for (const item of order.items) {
    const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
    if (productImageUrl && !productImages.has(productImageUrl)) {
      try {
        const imageData = await fetchImageAsBytes(productImageUrl);
        if (imageData && (imageData.type === 'png' || imageData.type === 'jpg')) {
          const img = imageData.type === 'png'
            ? await pdfDoc.embedPng(imageData.bytes)
            : await pdfDoc.embedJpg(imageData.bytes);
          productImages.set(productImageUrl, img);
          console.log("[generate-order-pdf] product image embedded successfully");
        }
      } catch (e) {
        console.log("[generate-order-pdf] product image error:", e);
      }
    }
  }
  
  // Calculate how many items fit per page
  const headerHeight = 180; // Header + customer info
  const totalsHeight = 150; // Totals section
  const availableHeightFirstPage = PAGE_HEIGHT - MARGIN - headerHeight - totalsHeight - FOOTER_HEIGHT;
  const availableHeightOtherPages = PAGE_HEIGHT - MARGIN * 2 - totalsHeight - FOOTER_HEIGHT;
  
  const itemsPerFirstPage = Math.floor(availableHeightFirstPage / ITEM_HEIGHT);
  const itemsPerOtherPage = Math.floor(availableHeightOtherPages / ITEM_HEIGHT);
  
  // Determine total pages needed
  let totalPages = 1;
  if (order.items.length > itemsPerFirstPage) {
    const remainingItems = order.items.length - itemsPerFirstPage;
    totalPages = 1 + Math.ceil(remainingItems / itemsPerOtherPage);
  }
  
  let currentItemIndex = 0;
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    
    // ========== HEADER SECTION (first page only) ==========
    if (isFirstPage) {
      // Logo on the left
      if (logoImage) {
        const logoHeight = 50;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        page.drawImage(logoImage, {
          x: MARGIN,
          y: y - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
      } else {
        page.drawText("LOJA ATACADO TG GRIFFES", {
          x: MARGIN,
          y: y - 35,
          size: 20,
          font: fontBold,
          color: black,
        });
      }
      
      // Order number on the right
      const orderLabel = order.orderNumber ? `Pedido #${order.orderNumber}` : "";
      if (orderLabel) {
        const labelWidth = fontBold.widthOfTextAtSize(orderLabel, 18);
        page.drawText(orderLabel, {
          x: PAGE_WIDTH - MARGIN - labelWidth,
          y: y - 25,
          size: 18,
          font: fontBold,
          color: black,
        });
        
        const dateWidth = fontRegular.widthOfTextAtSize(order.orderDate, 11);
        page.drawText(order.orderDate, {
          x: PAGE_WIDTH - MARGIN - dateWidth,
          y: y - 45,
          size: 11,
          font: fontRegular,
          color: gray,
        });
      }
      
      y -= 80;
      
      // Divider line
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 1,
        color: lightGray,
      });
      
      y -= 30;
      
      // ========== CUSTOMER SECTION ==========
      page.drawText("CLIENTE", { x: MARGIN, y, size: 10, font: fontBold, color: gray });
      y -= 20;
      
      page.drawText(order.customerName, { x: MARGIN, y, size: 14, font: fontBold, color: black });
      y -= 20;
      
      page.drawText(`WhatsApp: ${formatPhone(order.customerWhatsapp)}`, {
        x: MARGIN,
        y,
        size: 11,
        font: fontRegular,
        color: gray,
      });
      
      if (order.destCep) {
        page.drawText(`CEP: ${formatCep(order.destCep)}`, {
          x: MARGIN + 200,
          y,
          size: 11,
          font: fontRegular,
          color: gray,
        });
      }
      
      y -= 30;
      
      // Divider
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 1,
        color: lightGray,
      });
      
      y -= 30;
    } else {
      // Continuation header for other pages
      const continueText = `Pedido #${order.orderNumber || ''} - Página ${pageNum}/${totalPages}`;
      page.drawText(continueText, {
        x: MARGIN,
        y: y - 20,
        size: 12,
        font: fontBold,
        color: black,
      });
      y -= 50;
    }
    
    // ========== ITEMS SECTION ==========
    if (isFirstPage || pageNum > 1) {
      page.drawText("ITENS DO PEDIDO", { x: MARGIN, y, size: 10, font: fontBold, color: gray });
      y -= 25;
    }
    
    const itemsThisPage = isFirstPage ? itemsPerFirstPage : itemsPerOtherPage;
    const endIndex = Math.min(currentItemIndex + itemsThisPage, order.items.length);
    
    for (let i = currentItemIndex; i < endIndex; i++) {
      const item = order.items[i];
      const rowStartY = y;
      const imgSize = 60;
      
      // Draw item background
      page.drawRectangle({
        x: MARGIN,
        y: rowStartY - imgSize - 10,
        width: CONTENT_WIDTH,
        height: imgSize + 20,
        color: rgb(0.97, 0.97, 0.97),
        borderColor: lightGray,
        borderWidth: 0.5,
      });
      
      // Product image
      const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
      const productImg = productImageUrl ? productImages.get(productImageUrl) : null;
      
      if (productImg) {
        page.drawImage(productImg, {
          x: MARGIN + 10,
          y: rowStartY - imgSize - 5,
          width: imgSize,
          height: imgSize,
        });
      } else {
        // Draw placeholder
        page.drawRectangle({
          x: MARGIN + 10,
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
          x: MARGIN + 10 + (imgSize - placeholderWidth) / 2,
          y: rowStartY - imgSize / 2 - 2,
          size: 10,
          font: fontRegular,
          color: gray,
        });
        
        const placeholderText2 = "FOTO";
        const placeholderWidth2 = fontRegular.widthOfTextAtSize(placeholderText2, 10);
        page.drawText(placeholderText2, {
          x: MARGIN + 10 + (imgSize - placeholderWidth2) / 2,
          y: rowStartY - imgSize / 2 - 15,
          size: 10,
          font: fontRegular,
          color: gray,
        });
      }
      
      const textX = MARGIN + imgSize + 25;
      
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
      
      // Price info
      const unitPriceText = formatPrice(item.unitPriceCents);
      const qtyText = `×${item.quantity}`;
      const lineTotalText = formatPrice(item.unitPriceCents * item.quantity);
      
      const priceLayout = `${unitPriceText}  ${qtyText}`;
      page.drawText(priceLayout, {
        x: textX,
        y: rowStartY - 58,
        size: 10,
        font: fontRegular,
        color: gray,
      });
      
      // Line total (right aligned)
      const lineTotalWidth = fontBold.widthOfTextAtSize(lineTotalText, 13);
      page.drawText(lineTotalText, {
        x: PAGE_WIDTH - MARGIN - 15 - lineTotalWidth,
        y: rowStartY - 35,
        size: 13,
        font: fontBold,
        color: black,
      });
      
      y = rowStartY - imgSize - 25;
      currentItemIndex++;
    }
    
    // ========== TOTALS SECTION (last page only) ==========
    if (isLastPage) {
      y -= 15;
      
      // Divider before totals
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 1,
        color: lightGray,
      });
      
      y -= 30;
      
      const totalsLabelX = PAGE_WIDTH - MARGIN - 220;
      const totalsValueX = PAGE_WIDTH - MARGIN - 10;
      
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
      const shippingLabel = order.skipShipping ? 'Frete' : `Frete (${order.shippingService})`;
      page.drawText(shippingLabel, {
        x: totalsLabelX,
        y,
        size: 11,
        font: fontRegular,
        color: gray,
      });
      const shippingText = order.skipShipping ? 'A combinar' : formatPrice(order.shippingPriceCents);
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
        end: { x: PAGE_WIDTH - MARGIN, y: y + 10 },
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
      const totalText = order.skipShipping 
        ? `${formatPrice(order.subtotalCents)} + Frete` 
        : formatPrice(order.totalCents);
      const totalWidth = fontBold.widthOfTextAtSize(totalText, 16);
      page.drawText(totalText, {
        x: totalsValueX - totalWidth,
        y,
        size: 16,
        font: fontBold,
        color: black,
      });
    }
    
    // ========== FOOTER (all pages) ==========
    const footerY = MARGIN + 20;
    const footerText = `Loja Atacado TG Griffes • Streetwear Premium${totalPages > 1 ? ` • Página ${pageNum}/${totalPages}` : ''}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 10);
    page.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: footerY,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    
    // Decorative line above footer
    page.drawLine({
      start: { x: MARGIN + 100, y: footerY + 20 },
      end: { x: PAGE_WIDTH - MARGIN - 100, y: footerY + 20 },
      thickness: 0.5,
      color: lightGray,
    });
  }
  
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
      skipShipping: orderData.skipShipping,
    });

    for (let i = 0; i < (orderData.items?.length ?? 0); i++) {
      console.log(`[generate-order-pdf] item ${i}:`, {
        name: orderData.items[i].productName,
        imageUrl: orderData.items[i].imageUrl,
      });
    }

    const pdfBytes = await generatePDF(orderData);
    console.log("[generate-order-pdf] PDF generated with", pdfBytes.length, "bytes");

    // Upload to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `pedido-${orderData.orderNumber || Date.now()}.pdf`;
    
    console.log("[generate-order-pdf] uploading PDF", {
      bucket: "order-pdfs",
      filePath: fileName,
      size: pdfBytes.length,
    });

    const { error: uploadError } = await supabase.storage
      .from("order-pdfs")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-order-pdf] upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("order-pdfs")
      .getPublicUrl(fileName);

    console.log("[generate-order-pdf] done", { pdfUrl: publicUrlData.publicUrl });

    return new Response(
      JSON.stringify({ pdfUrl: publicUrlData.publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[generate-order-pdf] error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
