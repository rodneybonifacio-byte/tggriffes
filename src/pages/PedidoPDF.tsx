import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PedidoPDF() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Pedido #{orderNumber}</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">Pedido #{orderNumber}</h1>
        </div>
        <a 
          href={pdfUrl!} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Abrir em nova aba
          <ExternalLink className="h-4 w-4" />
        </a>
      </header>

      {/* PDF Viewer */}
      <iframe
        src={pdfUrl!}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 57px)' }}
        title={`Pedido #${orderNumber}`}
      />
    </div>
  );
}
