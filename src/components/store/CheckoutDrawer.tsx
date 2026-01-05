import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCart, CartItem } from '@/hooks/useCart';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { ShippingCalculator, ShippingOption } from './ShippingCalculator';
import { formatPrice, formatCEP, formatWhatsApp } from '@/lib/utils';
import { Loader2, Package, Truck, User, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutDrawer({ open, onOpenChange }: CheckoutDrawerProps) {
  const { items, totalCents, clearCart } = useCart();
  const { data: settings } = useStoreSettings();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'info' | 'shipping' | 'review'>('info');
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [destCep, setDestCep] = useState('');
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const subtotalCents = totalCents;
  const shippingCents = selectedShipping?.price || 0;
  const finalTotalCents = subtotalCents + shippingCents;

  const handleWhatsappChange = (value: string) => {
    const formatted = formatWhatsApp(value);
    setCustomerWhatsapp(formatted);
  };

  const handleCepChange = (cep: string) => {
    setDestCep(cep);
  };

  const canProceedToShipping = customerName.trim().length >= 2 && customerWhatsapp.replace(/\D/g, '').length >= 10;
  const canProceedToReview = selectedShipping !== null;

  const generateOrderSummaryText = (orderNumber?: number, pdfUrl?: string) => {
    const itemsList = items.map(item => {
      const colorText = item.color ? ` • ${item.color}` : '';
      return `   ▸ ${item.quantity}x ${item.productName}\n      Tam: ${item.size}${colorText}\n      ${formatPrice(item.unitPriceCents * item.quantity)}`;
    }).join('\n\n');

    const orderLabel = orderNumber ? `#${orderNumber}` : '';
    const shippingDays = selectedShipping?.deadline === 1 ? '1 dia útil' : `${selectedShipping?.deadline} dias úteis`;

    let message = `━━━━━━━━━━━━━━━━━━━━━
✨ *NOVO PEDIDO ${orderLabel}* ✨
      *TG GRIFFES*
━━━━━━━━━━━━━━━━━━━━━

👤 *Cliente*
${customerName}

📱 *WhatsApp*
${customerWhatsapp}

📍 *CEP de Entrega*
${formatCEP(destCep)}

━━━━━━━━━━━━━━━━━━━━━
📦 *ITENS DO PEDIDO*
━━━━━━━━━━━━━━━━━━━━━

${itemsList}

━━━━━━━━━━━━━━━━━━━━━
🚚 *ENVIO*
${selectedShipping?.service} • ${shippingDays}
Frete: ${formatPrice(shippingCents)}

━━━━━━━━━━━━━━━━━━━━━
💵 *RESUMO*
━━━━━━━━━━━━━━━━━━━━━
Subtotal: ${formatPrice(subtotalCents)}
Frete: ${formatPrice(shippingCents)}

💰 *TOTAL: ${formatPrice(finalTotalCents)}*`;

    if (pdfUrl) {
      message += `

━━━━━━━━━━━━━━━━━━━━━
📄 *DETALHES DO PEDIDO*
${pdfUrl}
━━━━━━━━━━━━━━━━━━━━━`;
    }

    message += `

_Obrigado pela preferência!_ 🙏
*TG GRIFFES* | Streetwear Premium`;

    return message;
  };

  const handleFinalize = async () => {
    if (!settings?.seller_whatsapp) {
      toast({
        title: 'Erro',
        description: 'Configuração da loja incompleta.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Get next order number using RPC
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('get_next_order_number');
      
      if (orderNumberError) throw orderNumberError;
      const orderNumber = orderNumberData as number;

      // 2. Save order intent to database
      const orderIntentId = crypto.randomUUID();

      const { error: orderError } = await supabase
        .from('order_intents')
        .insert({
          id: orderIntentId,
          order_number: orderNumber,
          customer_name: customerName,
          customer_whatsapp: customerWhatsapp.replace(/\D/g, ''),
          dest_cep: destCep,
          subtotal_cents: subtotalCents,
          shipping_service: selectedShipping?.service,
          shipping_price_cents: shippingCents,
          shipping_deadline_days: selectedShipping?.deadline,
          total_cents: finalTotalCents,
          status: 'NOVO',
        });

      if (orderError) throw orderError;

      // 3. Save order items
      const orderItems = items.map(item => ({
        order_intent_id: orderIntentId,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        size: item.size,
        qty: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.unitPriceCents * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_intent_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 4. Generate PDF
      const baseUrl = window.location.origin;
      const logoUrl = `${baseUrl}/logo.png`;

      const orderData = {
        orderNumber,
        customerName,
        customerWhatsapp: customerWhatsapp.replace(/\D/g, ''),
        destCep,
        items: items.map(item => ({
          productName: item.productName,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          imageUrl: item.imageUrl,
        })),
        subtotalCents,
        shippingService: selectedShipping?.service || '',
        shippingPriceCents: shippingCents,
        shippingDeadlineDays: selectedShipping?.deadline || 0,
        totalCents: finalTotalCents,
        orderDate: new Date().toLocaleDateString('pt-BR'),
        logoUrl,
        siteUrl: baseUrl,
      };

      const { data: pdfResponse, error: pdfError } = await supabase.functions.invoke('generate-order-pdf', {
        body: orderData,
      });

      if (pdfError) {
        console.error('PDF generation error:', pdfError);
      }

      // 5. Generate message with clean PDF URL and open WhatsApp
      const cleanPdfUrl = `${window.location.origin}/pedidos/pdf/${orderNumber}`;
      const message = generateOrderSummaryText(orderNumber, cleanPdfUrl);
      const whatsappNumber = settings.seller_whatsapp.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      
      // 5. Clear cart and show success
      setOrderComplete(true);
      clearCart();

      toast({
        title: 'Pedido enviado!',
        description: 'O resumo foi aberto no WhatsApp com o link do PDF.',
      });

      // Use window.location to redirect to WhatsApp
      window.location.href = whatsappUrl;

    } catch (error) {
      console.error('Error finalizing order:', error);
      toast({
        title: 'Erro ao finalizar pedido',
        description: 'Tente novamente ou entre em contato pelo WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (orderComplete) {
      setStep('info');
      setCustomerName('');
      setCustomerWhatsapp('');
      setDestCep('');
      setSelectedShipping(null);
      setOrderComplete(false);
    }
    onOpenChange(false);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {['info', 'shipping', 'review'].map((s, idx) => (
        <div key={s} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === s ? 'bg-primary text-primary-foreground' : 
            ['info', 'shipping', 'review'].indexOf(step) > idx ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
          }`}>
            {idx + 1}
          </div>
          {idx < 2 && <div className={`w-8 h-0.5 ${
            ['info', 'shipping', 'review'].indexOf(step) > idx ? 'bg-primary' : 'bg-secondary'
          }`} />}
        </div>
      ))}
    </div>
  );

  if (orderComplete) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="flex flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Pedido Enviado!</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Tudo certo!</h3>
              <p className="text-muted-foreground mb-6">
                Seu pedido foi registrado e enviado para o WhatsApp da loja.
                O link do PDF do pedido foi incluído na mensagem.
              </p>
            <Button onClick={handleClose} className="w-full max-w-xs">
              Voltar às compras
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Finalizar Pedido</SheetTitle>
          <SheetDescription>
            {step === 'info' && 'Preencha seus dados para continuar'}
            {step === 'shipping' && 'Escolha a forma de envio'}
            {step === 'review' && 'Confira seu pedido antes de enviar'}
          </SheetDescription>
        </SheetHeader>
        
        {renderStepIndicator()}
        
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Customer Info */}
          {step === 'info' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <User className="h-5 w-5" />
                <span className="font-medium">Seus Dados</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="(11) 99999-9999"
                  value={customerWhatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  maxLength={15}
                />
              </div>

              <Separator className="my-6" />

              {/* Cart Summary */}
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Package className="h-5 w-5" />
                <span className="font-medium">Itens ({items.length})</span>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-secondary/50 rounded-lg">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.productName} className="w-14 h-14 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Tam: {item.size} {item.color && `• ${item.color}`} • Qtd: {item.quantity}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        {formatPrice(item.unitPriceCents * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-lg font-semibold pt-4">
                <span>Subtotal:</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
            </div>
          )}

          {/* Step 2: Shipping */}
          {step === 'shipping' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Truck className="h-5 w-5" />
                <span className="font-medium">Entrega</span>
              </div>

              <ShippingCalculator
                onSelectOption={setSelectedShipping}
                selectedOption={selectedShipping}
                onCepChange={handleCepChange}
              />

              {selectedShipping && (
                <div className="pt-4 space-y-2">
                  <Separator />
                  <div className="flex justify-between text-sm pt-2">
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotalCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frete ({selectedShipping.service}):</span>
                    <span>{formatPrice(shippingCents)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2">
                    <span>Total:</span>
                    <span>{formatPrice(finalTotalCents)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <FileText className="h-5 w-5" />
                <span className="font-medium">Resumo do Pedido</span>
              </div>

              <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{customerName}</p>
                  <p className="text-sm text-muted-foreground">{customerWhatsapp}</p>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-xs text-muted-foreground">Entrega</p>
                  <p className="font-medium">{selectedShipping?.service} - {selectedShipping?.deadline} dias úteis</p>
                  <p className="text-sm text-muted-foreground">CEP: {formatCEP(destCep)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-medium">Itens:</p>
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.productName} ({item.size})
                    </span>
                    <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatPrice(subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frete:</span>
                  <span>{formatPrice(shippingCents)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>Total:</span>
                  <span>{formatPrice(finalTotalCents)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-4">
                Ao finalizar, você será redirecionado para o WhatsApp e um PDF do pedido será gerado.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t space-y-2">
          {step === 'info' && (
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setStep('shipping')}
              disabled={!canProceedToShipping}
            >
              Continuar para Entrega
            </Button>
          )}
          
          {step === 'shipping' && (
            <>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setStep('review')}
                disabled={!canProceedToReview}
              >
                Revisar Pedido
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setStep('info')}
              >
                Voltar
              </Button>
            </>
          )}
          
          {step === 'review' && (
            <>
              <Button 
                className="w-full gap-2" 
                size="lg"
                onClick={handleFinalize}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                )}
                Finalizar e Enviar WhatsApp
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setStep('shipping')}
              >
                Voltar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
