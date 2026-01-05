import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function PedidoPDF() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) {
      setError('Número do pedido não informado');
      return;
    }

    // Build the storage URL for the PDF
    const fileName = `pedido-${orderNumber}.pdf`;
    const { data } = supabase.storage.from('order-pdfs').getPublicUrl(fileName);
    
    if (data?.publicUrl) {
      setPdfUrl(data.publicUrl);
    } else {
      setError('PDF não encontrado');
    }
  }, [orderNumber]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Erro</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <iframe
        src={pdfUrl}
        className="w-full h-screen border-0"
        title={`Pedido #${orderNumber}`}
      />
    </div>
  );
}
