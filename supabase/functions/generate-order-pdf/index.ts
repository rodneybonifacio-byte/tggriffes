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

async function generatePDF(order: OrderData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.95, 0.95, 0.95);
  
  let y = height - 50;
  const margin = 50;
  const contentWidth = width - margin * 2;
  
  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: black,
  });
  
  // Store name
  page.drawText("TG GRIFFES", {
    x: margin,
    y: height - 50,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  
  // Order number
  const orderLabel = order.orderNumber ? `Pedido #${order.orderNumber}` : "Confirmação de Pedido";
  page.drawText(orderLabel, {
    x: margin,
    y: height - 75,
    size: 14,
    font: fontRegular,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  // Date on the right
  const dateText = order.orderDate;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 12);
  page.drawText(dateText, {
    x: width - margin - dateWidth,
    y: height - 50,
    size: 12,
    font: fontRegular,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  y = height - 130;
  
  // Customer section
  page.drawText("DADOS DO CLIENTE", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: black,
  });
  y -= 25;
  
  // Customer info box
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: contentWidth,
    height: 80,
    color: lightGray,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });
  
  page.drawText("Nome:", { x: margin + 15, y: y - 5, size: 10, font: fontRegular, color: gray });
  page.drawText(order.customerName, { x: margin + 15, y: y - 20, size: 12, font: fontBold, color: black });
  
  page.drawText("WhatsApp:", { x: margin + 200, y: y - 5, size: 10, font: fontRegular, color: gray });
  page.drawText(formatPhone(order.customerWhatsapp), { x: margin + 200, y: y - 20, size: 12, font: fontBold, color: black });
  
  page.drawText("CEP de Entrega:", { x: margin + 15, y: y - 40, size: 10, font: fontRegular, color: gray });
  page.drawText(formatCep(order.destCep), { x: margin + 15, y: y - 55, size: 12, font: fontBold, color: black });
  
  y -= 100;
  
  // Items section
  page.drawText("ITENS DO PEDIDO", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: black,
  });
  y -= 25;
  
  // Table header
  page.drawRectangle({
    x: margin,
    y: y - 15,
    width: contentWidth,
    height: 20,
    color: lightGray,
  });
  
  page.drawText("Produto", { x: margin + 10, y: y - 10, size: 10, font: fontBold, color: gray });
  page.drawText("Tam.", { x: margin + 250, y: y - 10, size: 10, font: fontBold, color: gray });
  page.drawText("Qtd", { x: margin + 310, y: y - 10, size: 10, font: fontBold, color: gray });
  page.drawText("Unit.", { x: margin + 360, y: y - 10, size: 10, font: fontBold, color: gray });
  page.drawText("Total", { x: margin + 430, y: y - 10, size: 10, font: fontBold, color: gray });
  
  y -= 30;
  
  // Items
  for (const item of order.items) {
    const productText = item.productName.length > 30 
      ? item.productName.substring(0, 27) + "..." 
      : item.productName;
    const sizeText = item.size + (item.color ? ` (${item.color})` : "");
    const lineTotal = item.unitPriceCents * item.quantity;
    
    page.drawText(productText, { x: margin + 10, y, size: 10, font: fontRegular, color: black });
    page.drawText(sizeText.substring(0, 12), { x: margin + 250, y, size: 10, font: fontRegular, color: black });
    page.drawText(String(item.quantity), { x: margin + 310, y, size: 10, font: fontRegular, color: black });
    page.drawText(formatPrice(item.unitPriceCents), { x: margin + 360, y, size: 10, font: fontRegular, color: black });
    page.drawText(formatPrice(lineTotal), { x: margin + 430, y, size: 10, font: fontBold, color: black });
    
    y -= 20;
    
    // Draw separator line
    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: width - margin, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
  }
  
  y -= 20;
  
  // Totals section
  page.drawRectangle({
    x: margin + 280,
    y: y - 80,
    width: contentWidth - 280,
    height: 90,
    color: lightGray,
  });
  
  const totalsX = margin + 295;
  const valuesX = width - margin - 15;
  
  // Subtotal
  page.drawText("Subtotal:", { x: totalsX, y: y - 15, size: 11, font: fontRegular, color: gray });
  const subtotalText = formatPrice(order.subtotalCents);
  const subtotalWidth = fontRegular.widthOfTextAtSize(subtotalText, 11);
  page.drawText(subtotalText, { x: valuesX - subtotalWidth, y: y - 15, size: 11, font: fontRegular, color: black });
  
  // Shipping
  const shippingLabel = `Frete (${order.shippingService} - ${order.shippingDeadlineDays} dias):`;
  page.drawText(shippingLabel, { x: totalsX, y: y - 35, size: 11, font: fontRegular, color: gray });
  const shippingText = formatPrice(order.shippingPriceCents);
  const shippingWidth = fontRegular.widthOfTextAtSize(shippingText, 11);
  page.drawText(shippingText, { x: valuesX - shippingWidth, y: y - 35, size: 11, font: fontRegular, color: black });
  
  // Separator line
  page.drawLine({
    start: { x: totalsX, y: y - 50 },
    end: { x: width - margin - 10, y: y - 50 },
    thickness: 1,
    color: black,
  });
  
  // Total
  page.drawText("TOTAL:", { x: totalsX, y: y - 70, size: 14, font: fontBold, color: black });
  const totalText = formatPrice(order.totalCents);
  const totalWidth = fontBold.widthOfTextAtSize(totalText, 14);
  page.drawText(totalText, { x: valuesX - totalWidth, y: y - 70, size: 14, font: fontBold, color: black });
  
  // Footer
  page.drawText("Obrigado por comprar conosco!", {
    x: margin,
    y: 60,
    size: 11,
    font: fontRegular,
    color: gray,
  });
  
  page.drawText("TG GRIFFES • Streetwear Premium", {
    x: margin,
    y: 40,
    size: 10,
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
    });

    const pdfBytes = await generatePDF(orderData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderNum = orderData.orderNumber || Date.now();
    const filePath = `pedido-${orderNum}.pdf`;

    console.log("[generate-order-pdf] uploading PDF", { bucket: "order-pdfs", filePath });

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
