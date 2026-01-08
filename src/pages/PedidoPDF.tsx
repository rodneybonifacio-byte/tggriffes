import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Loader2, FileText, Download, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PedidoPDF() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: settings } = useStoreSettings();

  useEffect(() => {
    if (!orderNumber) {
      setError('Número do pedido não informado');
      setLoading(false);
      return;
    }

    // Build the storage URL for the PDF
    const fileName = `pedido-${orderNumber}.pdf`;
    const { data } = supabase.storage.from('order-pdfs').getPublicUrl(fileName);
    
    if (data?.publicUrl) {
      // Verify the PDF exists
      fetch(data.publicUrl, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            setPdfUrl(data.publicUrl);
          } else {
            setError('PDF não encontrado. O pedido pode ainda não ter sido processado.');
          }
        })
        .catch(() => {
          setError('Erro ao verificar PDF');
        })
        .finally(() => setLoading(false));
    } else {
      setError('PDF não encontrado');
      setLoading(false);
    }
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground font-medium">Carregando documento...</p>
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
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
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
          
          <a 
            href={pdfUrl!} 
            download={`pedido-${orderNumber}.pdf`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </a>
        </div>
      </header>

      {/* PDF Viewer */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-lg overflow-hidden border">
          <iframe
            src={pdfUrl!}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 120px)' }}
            title={`Pedido #${orderNumber}`}
          />
        </div>
      </div>
    </div>
  );
}
