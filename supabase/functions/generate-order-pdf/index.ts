import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

function resolveAssetUrl(maybeUrl: string | undefined, siteUrl?: string): string | undefined {
  if (!maybeUrl) return undefined;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  if (!siteUrl) return maybeUrl;

  try {
    return new URL(maybeUrl, siteUrl).toString();
  } catch {
    return maybeUrl;
  }
}

function generateOrderHTML(order: OrderData): string {
  const itemsHtml = order.items
    .map((item) => {
      const imageUrl = resolveAssetUrl(item.imageUrl, order.siteUrl);
      return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; width: 60px;">
        ${imageUrl
          ? `<img src="${imageUrl}" alt="${item.productName}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />`
          : '<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px;"></div>'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${item.productName}</strong><br>
        <span style="color: #666; font-size: 12px;">Tam: ${item.size}${item.color ? ` • Cor: ${item.color}` : ""}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.unitPriceCents)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.unitPriceCents * item.quantity)}</td>
    </tr>
  `;
    })
    .join("");

  const logoUrl = resolveAssetUrl(order.logoUrl, order.siteUrl);
  const orderNumberLabel = order.orderNumber ? `#${order.orderNumber}` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido ${orderNumberLabel} - TG GRIFFES</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: #000; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header img { max-height: 60px; margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; }
    .header p { margin: 10px 0 0; opacity: 0.8; font-size: 14px; }
    .order-number { font-size: 18px; font-weight: bold; margin-top: 8px; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { background: #f9f9f9; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 11px; color: #666; text-transform: uppercase; }
    .info-value { font-size: 14px; font-weight: 500; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
    .totals { background: #f9f9f9; padding: 20px; border-radius: 6px; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .total-row.final { font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : "<h1>TG GRIFFES</h1>"}
      <p>Confirmação de Pedido</p>
      ${order.orderNumber ? `<div class="order-number">Pedido ${orderNumberLabel}</div>` : ""}
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">Dados do Cliente</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nome</div>
            <div class="info-value">${order.customerName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">WhatsApp</div>
            <div class="info-value">${formatPhone(order.customerWhatsapp)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">CEP de Entrega</div>
            <div class="info-value">${formatCep(order.destCep)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data do Pedido</div>
            <div class="info-value">${order.orderDate}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Itens do Pedido</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Foto</th>
              <th>Produto</th>
              <th style="text-align: center;">Qtd</th>
              <th style="text-align: right;">Unit.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${formatPrice(order.subtotalCents)}</span>
          </div>
          <div class="total-row">
            <span>Frete (${order.shippingService} - ${order.shippingDeadlineDays} dias úteis)</span>
            <span>${formatPrice(order.shippingPriceCents)}</span>
          </div>
          <div class="total-row final">
            <span>Total</span>
            <span>${formatPrice(order.totalCents)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Obrigado por comprar conosco!</p>
      <p>TG GRIFFES • Streetwear Premium</p>
    </div>
  </div>
</body>
</html>
  `;
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

    const html = generateOrderHTML(orderData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use order number for cleaner file naming
    const orderNum = orderData.orderNumber || Date.now();
    const filePath = `pedido-${orderNum}.html`;

    console.log("[generate-order-pdf] uploading", { bucket: "order-pdfs", filePath });

    const bytes = new TextEncoder().encode(html);

    const { error: uploadError } = await supabase.storage
      .from("order-pdfs")
      .upload(filePath, bytes, {
        contentType: "text/html; charset=utf-8",
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
