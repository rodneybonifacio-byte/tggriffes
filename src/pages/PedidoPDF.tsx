import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Loader2, FileText, Download, ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PedidoPDF() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: settings } = useStoreSettings();

  const generatePdf = useCallback(async () => {
    if (!orderNumber) {
      setError('Número do pedido não informado');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch order data
      const { data: order, error: orderError } = await supabase
        .from('order_intents')
        .select(`
          *,
          order_intent_items (*)
        `)
        .eq('order_number', parseInt(orderNumber))
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        setError('Pedido não encontrado');
        setLoading(false);
        return;
      }

      // Build order data for PDF generation
      const orderData = {
        orderNumber: order.order_number,
        orderDate: new Date(order.created_at).toLocaleDateString('pt-BR'),
        customerName: order.customer_name || '',
        customerWhatsapp: order.customer_whatsapp || '',
        destCep: order.dest_cep || '',
        shippingService: order.shipping_service || '',
        shippingPriceCents: order.shipping_price_cents || 0,
        shippingDeadlineDays: order.shipping_deadline_days || 0,
        subtotalCents: order.subtotal_cents || 0,
        totalCents: order.total_cents || 0,
        observations: order.observations || '',
        skipShipping: !order.dest_cep,
        siteUrl: window.location.origin,
        logoUrl: settings?.store_logo_url || '',
        items: order.order_intent_items?.map((item: any) => ({
          productName: item.product_name,
          size: item.size,
          color: item.color || '',
          qty: item.qty,
          unitPriceCents: item.unit_price_cents,
          lineTotalCents: item.line_total_cents,
          imageUrl: '', // Images not stored in order items
          category: '',
        })) || [],
      };

      // Generate PDF on demand
      const { data, error: pdfError } = await supabase.functions.invoke('generate-order-pdf', {
        body: orderData,
      });

      if (pdfError) throw pdfError;
      if (data?.error) throw new Error(data.error);

      if (data?.pdfBase64) {
        // Convert base64 to blob URL
        const binaryString = atob(data.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } else {
        throw new Error('PDF não gerado');
      }
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setError(err.message || 'Erro ao gerar PDF');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, settings?.store_logo_url]);

  useEffect(() => {
    generatePdf();
    
    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [generatePdf]);

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `pedido-${orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground font-medium">Gerando documento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Pedido #{orderNumber}</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={generatePdf} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.store_logo_url ? (
              <img 
                src={settings.store_logo_url} 
                alt={settings?.store_name || 'Logo'} 
                className="h-8 object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="font-bold">{settings?.store_name || 'Loja'}</span>
              </div>
            )}
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm sm:text-base">Pedido #{orderNumber}</span>
            </div>
          </div>
          
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </Button>
        </div>
      </header>

      {/* PDF Viewer */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-lg overflow-hidden border">
          <iframe
            src={pdfBlobUrl!}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 120px)' }}
            title={`Pedido #${orderNumber}`}
          />
        </div>
      </div>
    </div>
  );
}