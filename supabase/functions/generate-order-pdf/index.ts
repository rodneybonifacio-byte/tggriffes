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
  category?: string;
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
  observations?: string | null;
  orderDate: string;
  logoUrl?: string;
  siteUrl?: string;
  // Shipping calculation data
  shippingWeightGrams?: number;
  shippingLengthCm?: number;
  shippingWidthCm?: number;
  shippingHeightCm?: number;
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
    
    // IMPORTANT: Skip if response is HTML (happens with preview URLs that serve the SPA)
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      console.log("[generate-order-pdf] skipping non-image content-type:", contentType);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    console.log("[generate-order-pdf] image fetched:", { size: bytes.length, contentType, convertedUrl });
    
    // Determine image type from content-type header first, then URL
    let type = 'unknown';
    if (contentType.includes('image/png')) {
      type = 'png';
    } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
      type = 'jpg';
    } else if (convertedUrl.includes('output=jpg')) {
      // wsrv.nl conversion
      type = 'jpg';
    } else if (contentType.includes('image/')) {
      // For other image types, try to detect from URL
      if (convertedUrl.toLowerCase().includes('.png')) {
        type = 'png';
      } else if (convertedUrl.toLowerCase().includes('.jpg') || convertedUrl.toLowerCase().includes('.jpeg')) {
        type = 'jpg';
      }
    }
    
    if (type === 'unknown') {
      console.log("[generate-order-pdf] could not determine image type for:", contentType);
      return null;
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

// Constants for layout - optimized for ~10 items per page with 60px photos
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 35;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const ITEM_HEIGHT = 68; // Adjusted for 60px image
const FOOTER_HEIGHT = 30;
const IMG_SIZE = 60; // Larger square image

async function generatePDF(order: OrderData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.88, 0.88, 0.88);
  const red = rgb(0.85, 0.1, 0.1);
  const green = rgb(0.1, 0.6, 0.2);
  
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
  
  // Group items by category
  const itemsByCategory = new Map<string, OrderItem[]>();
  for (const item of order.items) {
    const category = item.category || 'Outros';
    if (!itemsByCategory.has(category)) {
      itemsByCategory.set(category, []);
    }
    itemsByCategory.get(category)!.push(item);
  }
  
  // Sort categories alphabetically, but keep "Outros" at the end
  const sortedCategories = Array.from(itemsByCategory.keys()).sort((a, b) => {
    if (a === 'Outros') return 1;
    if (b === 'Outros') return -1;
    return a.localeCompare(b, 'pt-BR');
  });
  
  // Flatten items with category headers for page calculation
  const itemsWithHeaders: { type: 'category' | 'item'; category?: string; item?: OrderItem }[] = [];
  for (const category of sortedCategories) {
    itemsWithHeaders.push({ type: 'category', category });
    for (const item of itemsByCategory.get(category)!) {
      itemsWithHeaders.push({ type: 'item', item, category });
    }
  }
  
  // Calculate how many items fit per page - optimized for compact layout
  const headerHeight = 130; // Reduced header + customer info
  const totalsHeight = 100; // Reduced totals section
  const itemsHeaderHeight = 20; // "ITENS DO PEDIDO" label
  const categoryHeaderHeight = 28; // Height for category headers
  const availableHeightFirstPage = PAGE_HEIGHT - MARGIN - headerHeight - totalsHeight - FOOTER_HEIGHT;
  const availableHeightOtherPages = PAGE_HEIGHT - MARGIN * 2 - itemsHeaderHeight - FOOTER_HEIGHT;
  
  // With ITEM_HEIGHT = 68, calculate items per page
  const itemsPerFirstPage = Math.floor(availableHeightFirstPage / ITEM_HEIGHT);
  const itemsPerOtherPage = Math.floor(availableHeightOtherPages / ITEM_HEIGHT);
  
  // Determine total pages needed (accounting for category headers)
  let totalPages = 1;
  let tempHeight = availableHeightFirstPage;
  let currentPage = 1;
  
  for (const entry of itemsWithHeaders) {
    const entryHeight = entry.type === 'category' ? categoryHeaderHeight : ITEM_HEIGHT;
    if (tempHeight < entryHeight) {
      currentPage++;
      tempHeight = availableHeightOtherPages;
    }
    tempHeight -= entryHeight;
  }
  totalPages = currentPage;
  
  let currentEntryIndex = 0;
  let itemRowIndex = 0; // For alternating colors
  let lastCategory = '';
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    
    // ========== HEADER SECTION (first page only) ==========
    if (isFirstPage) {
      // Logo on the left - smaller
      if (logoImage) {
        const logoHeight = 35;
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
          y: y - 25,
          size: 14,
          font: fontBold,
          color: black,
        });
      }
      
      // Order number on the right
      const orderLabel = order.orderNumber ? `Pedido #${order.orderNumber}` : "";
      if (orderLabel) {
        const labelWidth = fontBold.widthOfTextAtSize(orderLabel, 14);
        page.drawText(orderLabel, {
          x: PAGE_WIDTH - MARGIN - labelWidth,
          y: y - 18,
          size: 14,
          font: fontBold,
          color: black,
        });
        
        const dateWidth = fontRegular.widthOfTextAtSize(order.orderDate, 9);
        page.drawText(order.orderDate, {
          x: PAGE_WIDTH - MARGIN - dateWidth,
          y: y - 32,
          size: 9,
          font: fontRegular,
          color: gray,
        });
      }
      
      y -= 50;
      
      // Divider line
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: lightGray,
      });
      
      y -= 18;
      
      // ========== CUSTOMER SECTION - compact single line ==========
      page.drawText("CLIENTE:", { x: MARGIN, y, size: 8, font: fontBold, color: gray });
      page.drawText(order.customerName, { x: MARGIN + 50, y, size: 10, font: fontBold, color: black });
      
      const whatsappText = `Tel: ${formatPhone(order.customerWhatsapp)}`;
      page.drawText(whatsappText, {
        x: MARGIN + 220,
        y,
        size: 9,
        font: fontRegular,
        color: gray,
      });
      
      if (order.destCep) {
        page.drawText(`CEP: ${formatCep(order.destCep)}`, {
          x: MARGIN + 380,
          y,
          size: 9,
          font: fontRegular,
          color: gray,
        });
      }
      
      y -= 20;
      
      // Divider
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: lightGray,
      });
      
      y -= 18;
    } else {
      // Continuation header for other pages - compact
      const continueText = `Pedido #${order.orderNumber || ''} - Pág. ${pageNum}/${totalPages}`;
      page.drawText(continueText, {
        x: MARGIN,
        y: y - 15,
        size: 10,
        font: fontBold,
        color: black,
      });
      y -= 35;
    }
    
    // ========== ITEMS SECTION ==========
    if (isFirstPage || pageNum > 1) {
      // Column headers
      page.drawText("ITENS DO PEDIDO", { x: MARGIN, y, size: 8, font: fontBold, color: gray });
      
      // Right side column header - only quantity
      page.drawText("QTD", { x: PAGE_WIDTH - MARGIN - 50, y, size: 7, font: fontBold, color: gray });
      y -= 12;
    }
    
    // Render items with category headers
    const availableHeight = isFirstPage ? availableHeightFirstPage : availableHeightOtherPages;
    let usedHeight = 0;
    
    while (currentEntryIndex < itemsWithHeaders.length) {
      const entry = itemsWithHeaders[currentEntryIndex];
      const entryHeight = entry.type === 'category' ? categoryHeaderHeight : ITEM_HEIGHT;
      
      // Check if entry fits on current page
      if (usedHeight + entryHeight > availableHeight) {
        break;
      }
      
      if (entry.type === 'category') {
        // Draw category header
        const categoryName = entry.category || 'Outros';
        
        // Draw category separator line
        page.drawLine({
          start: { x: MARGIN, y: y - 2 },
          end: { x: PAGE_WIDTH - MARGIN, y: y - 2 },
          thickness: 1,
          color: rgb(0.2, 0.2, 0.2),
        });
        
        // Draw category label with background
        page.drawRectangle({
          x: MARGIN,
          y: y - categoryHeaderHeight + 2,
          width: CONTENT_WIDTH,
          height: categoryHeaderHeight - 4,
          color: rgb(0.92, 0.92, 0.92),
        });
        
        page.drawText(categoryName.toUpperCase(), {
          x: MARGIN + 10,
          y: y - 18,
          size: 10,
          font: fontBold,
          color: rgb(0.25, 0.25, 0.25),
        });
        
        // Count items in this category
        const categoryItems = itemsByCategory.get(categoryName) || [];
        const categoryTotal = categoryItems.reduce((sum, it) => sum + it.quantity, 0);
        const countText = `${categoryTotal} peças`;
        const countWidth = fontRegular.widthOfTextAtSize(countText, 9);
        page.drawText(countText, {
          x: PAGE_WIDTH - MARGIN - countWidth - 10,
          y: y - 18,
          size: 9,
          font: fontRegular,
          color: gray,
        });
        
        y -= categoryHeaderHeight;
        usedHeight += categoryHeaderHeight;
        lastCategory = categoryName;
        itemRowIndex = 0; // Reset alternating for new category
      } else if (entry.item) {
        const item = entry.item;
        const rowStartY = y;
        
        // Alternating row background for readability
        if (itemRowIndex % 2 === 0) {
          page.drawRectangle({
            x: MARGIN,
            y: rowStartY - ITEM_HEIGHT + 4,
            width: CONTENT_WIDTH,
            height: ITEM_HEIGHT - 2,
            color: rgb(0.97, 0.97, 0.97),
          });
        }
        
        // Product image - compact 60x60
        const productImageUrl = resolveUrl(item.imageUrl, order.siteUrl);
        const productImg = productImageUrl ? productImages.get(productImageUrl) : null;
        
        const imgY = rowStartY - IMG_SIZE - 2;
        
        if (productImg) {
          page.drawImage(productImg, {
            x: MARGIN + 3,
            y: imgY,
            width: IMG_SIZE,
            height: IMG_SIZE,
          });
        } else {
          // Draw placeholder
          page.drawRectangle({
            x: MARGIN + 3,
            y: imgY,
            width: IMG_SIZE,
            height: IMG_SIZE,
            color: rgb(0.9, 0.9, 0.9),
            borderColor: lightGray,
            borderWidth: 0.5,
          });
        }
        
        const textX = MARGIN + IMG_SIZE + 14;
        const textY = rowStartY - 18;
        
        // Product name - LARGER font (13pt)
        const productText = item.productName.length > 26 
          ? item.productName.substring(0, 24) + "..." 
          : item.productName;
        
        page.drawText(productText, {
          x: textX,
          y: textY,
          size: 13,
          font: fontBold,
          color: black,
        });
        
        // Size - LARGER prominent display (11pt) - RED COLOR
        page.drawText(`Tam: ${item.size}`, {
          x: textX,
          y: textY - 18,
          size: 11,
          font: fontBold,
          color: red,
        });
        
        // Color - if available, show next to size (11pt)
        const colorText = item.color ? `Cor: ${item.color}` : '';
        if (colorText) {
          page.drawText(colorText, {
            x: textX + 70,
            y: textY - 18,
            size: 11,
            font: fontRegular,
            color: gray,
          });
        }
        
        // Quantity column - LARGER (12pt) - right aligned
        const qtyText = `${item.quantity}`;
        const qtyWidth = fontBold.widthOfTextAtSize(qtyText, 12);
        page.drawText(qtyText, {
          x: PAGE_WIDTH - MARGIN - qtyWidth - 10,
          y: textY - 6,
          size: 12,
          font: fontBold,
          color: black,
        });
        
        y -= ITEM_HEIGHT;
        usedHeight += ITEM_HEIGHT;
        itemRowIndex++;
      }
      
      currentEntryIndex++;
    }
    
    // ========== TOTALS SECTION (last page only) ==========
    if (isLastPage) {
      y -= 8;
      
      // Divider before variations summary
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: lightGray,
      });
      
      y -= 18;
      
      // ========== VARIATIONS SUMMARY - Clean Design ==========
      // Calculate summaries
      const sizesSummary = new Map<string, number>();
      const colorsSummary = new Map<string, number>();
      let totalPieces = 0;
      
      for (const item of order.items) {
        totalPieces += item.quantity;
        sizesSummary.set(item.size, (sizesSummary.get(item.size) || 0) + item.quantity);
        if (item.color) {
          colorsSummary.set(item.color, (colorsSummary.get(item.color) || 0) + item.quantity);
        }
      }
      
      // Sort sizes by common order
      const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'XXGG', 'EG', 'EGG'];
      const sortedSizes = Array.from(sizesSummary.entries())
        .sort((a, b) => {
          const aIdx = sizeOrder.indexOf(a[0].toUpperCase());
          const bIdx = sizeOrder.indexOf(b[0].toUpperCase());
          if (aIdx === -1 && bIdx === -1) return a[0].localeCompare(b[0]);
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      
      const sortedColors = Array.from(colorsSummary.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
      
      // Calculate how many lines we need for sizes and colors
      const sizesText = sortedSizes.map(([size, count]) => `${size}: ${count}`).join('   ');
      const colorsText = sortedColors.length > 0 
        ? sortedColors.map(([color, count]) => `${color}: ${count}`).join('   ')
        : '—';
      
      // Calculate column width for each section
      const halfWidth = (CONTENT_WIDTH - 30) / 2;
      const maxCharsPerLine = 32;
      
      // Split text into multiple lines if needed
      const wrapText = (text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] => {
        const items = text.split('   ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const item of items) {
          const testLine = currentLine ? `${currentLine}   ${item}` : item;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = item;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };
      
      const sizesLines = wrapText(sizesText, halfWidth - 10, fontBold, 9);
      const colorsLines = wrapText(colorsText, halfWidth - 10, fontBold, 9);
      const maxLines = Math.max(sizesLines.length, colorsLines.length);
      const lineHeight = 14;
      
      // Dynamic box height
      const summaryBoxHeight = 35 + (maxLines * lineHeight);
      const summaryBoxY = y - summaryBoxHeight;
      
      page.drawRectangle({
        x: MARGIN,
        y: summaryBoxY,
        width: CONTENT_WIDTH,
        height: summaryBoxHeight,
        color: rgb(0.96, 0.96, 0.96),
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5,
      });
      
      // Header row
      const headerY = y - 14;
      page.drawText("RESUMO", {
        x: MARGIN + 10,
        y: headerY,
        size: 8,
        font: fontBold,
        color: gray,
      });
      
      const totalLabel = `${totalPieces} peças`;
      const totalLabelWidth = fontBold.widthOfTextAtSize(totalLabel, 10);
      page.drawText(totalLabel, {
        x: PAGE_WIDTH - MARGIN - totalLabelWidth - 10,
        y: headerY,
        size: 10,
        font: fontBold,
        color: black,
      });
      
      // Content row - two columns
      const contentY = headerY - 20;
      
      // Sizes
      page.drawText("Tamanhos:", {
        x: MARGIN + 10,
        y: contentY,
        size: 7,
        font: fontRegular,
        color: gray,
      });
      
      sizesLines.forEach((line, i) => {
        page.drawText(line, {
          x: MARGIN + 10,
          y: contentY - 12 - (i * lineHeight),
          size: 9,
          font: fontBold,
          color: black,
        });
      });
      
      // Colors
      const colorsX = MARGIN + 10 + halfWidth + 10;
      page.drawText("Cores:", {
        x: colorsX,
        y: contentY,
        size: 7,
        font: fontRegular,
        color: gray,
      });
      
      colorsLines.forEach((line, i) => {
        page.drawText(line, {
          x: colorsX,
          y: contentY - 12 - (i * lineHeight),
          size: 9,
          font: sortedColors.length > 0 ? fontBold : fontRegular,
          color: sortedColors.length > 0 ? black : gray,
        });
      });
      
      y = summaryBoxY - 15;
      
      // ========== SHIPPING SECTION ==========
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: lightGray,
      });
      
      y -= 18;
      
      // Shipping header
      page.drawText("ENVIO", {
        x: MARGIN,
        y,
        size: 20,
        font: fontBold,
        color: black,
      });
      
      y -= 28;
      
      // Shipping method
      const shippingMethodText = order.skipShipping ? 'A combinar' : order.shippingService;
      page.drawText(`Método: ${shippingMethodText}`, {
        x: MARGIN,
        y,
        size: 20,
        font: fontRegular,
        color: black,
      });
      
      // If shipping was calculated (not skipped), show the package dimensions used
      if (!order.skipShipping && order.shippingWeightGrams) {
        y -= 28;
        
        // Package dimensions info
        const weightKg = (order.shippingWeightGrams / 1000).toFixed(2);
        const dimensionsText = `Peso: ${weightKg}kg  •  Dimensões: ${order.shippingLengthCm || 0}x${order.shippingWidthCm || 0}x${order.shippingHeightCm || 0}cm`;
        
        page.drawText(dimensionsText, {
          x: MARGIN,
          y,
          size: 20,
          font: fontRegular,
          color: black,
        });
        
        // Deadline
        if (order.shippingDeadlineDays > 0) {
          y -= 28;
          
          const deadlineText = order.shippingDeadlineDays === 1 
            ? '1 dia útil' 
            : `${order.shippingDeadlineDays} dias úteis`;
          
          page.drawText(`Prazo: ${deadlineText}`, {
            x: MARGIN,
            y,
            size: 20,
            font: fontRegular,
            color: black,
          });
        }
      }
      
      // ========== OBSERVATIONS SECTION ==========
      if (order.observations) {
        y -= 40;
        
        page.drawText("OBSERVAÇÕES:", {
          x: MARGIN,
          y,
          size: 9,
          font: fontBold,
          color: gray,
        });
        
        y -= 14;
        
        // Word wrap observations text - sanitize newlines first
        const maxWidth = CONTENT_WIDTH;
        // Replace newlines with spaces to avoid WinAnsi encoding errors
        const sanitizedObservations = order.observations.replace(/[\r\n]+/g, ' ').trim();
        const words = sanitizedObservations.split(' ').filter(w => w.length > 0);
        let line = '';
        const lines: string[] = [];
        
        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const testWidth = fontRegular.widthOfTextAtSize(testLine, 9);
          
          if (testWidth > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) lines.push(line);
        
        for (const textLine of lines) {
          page.drawText(textLine, {
            x: MARGIN,
            y,
            size: 9,
            font: fontRegular,
            color: black,
          });
          y -= 12;
        }
      }
    }
    
    // ========== FOOTER (all pages) - compact ==========
    const footerY = MARGIN + 8;
    const footerText = `TG Griffes • Streetwear Premium${totalPages > 1 ? ` • Pág ${pageNum}/${totalPages}` : ''}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8);
    page.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: gray,
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

    // Return PDF directly as base64 (no storage)
    // Using chunked approach to avoid stack overflow with large arrays
    const chunkSize = 8192;
    let base64Pdf = '';
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.slice(i, i + chunkSize);
      base64Pdf += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64Pdf = btoa(base64Pdf);
    
    console.log("[generate-order-pdf] returning PDF as base64, size:", base64Pdf.length);

    return new Response(
      JSON.stringify({ pdfBase64: base64Pdf }),
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
