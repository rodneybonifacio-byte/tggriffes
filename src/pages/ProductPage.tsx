import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StoreHeader } from '@/components/store/StoreHeader';
import { ProductGallery } from '@/components/store/ProductGallery';
import { ShippingCalculator, ShippingOption } from '@/components/store/ShippingCalculator';
import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { useProductBySlug } from '@/hooks/useProducts';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useCreateOrderIntent, useCreateOrderIntentItem } from '@/hooks/useOrders';
import { formatPrice, getWhatsAppLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Minus, Plus, Copy, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  preto: '#000000',
  branco: '#FFFFFF',
  azul: '#2563eb',
  vermelho: '#dc2626',
  verde: '#16a34a',
  amarelo: '#eab308',
  rosa: '#ec4899',
  roxo: '#9333ea',
  laranja: '#f97316',
  marrom: '#78350f',
  cinza: '#6b7280',
  bege: '#d4a574',
};

const getColorHex = (colorName: string) => {
  return COLOR_MAP[colorName.toLowerCase()] || '#888888';
};

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProductBySlug(slug);
  const { data: settings } = useStoreSettings();
  const { mutateAsync: createOrderIntent } = useCreateOrderIntent();
  const { mutateAsync: createOrderItem } = useCreateOrderIntentItem();
  const { toast } = useToast();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [cep, setCep] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get unique colors and sizes
  const colors = useMemo(() => {
    if (!product?.product_variants) return [];
    const uniqueColors = [...new Set(product.product_variants.map(v => v.color).filter(Boolean))];
    return uniqueColors as string[];
  }, [product?.product_variants]);

  const sizes = useMemo(() => {
    if (!product?.product_variants) return [];
    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const uniqueSizes = [...new Set(product.product_variants.map(v => v.size))];
    return uniqueSizes.sort((a, b) => {
      const indexA = sizeOrder.indexOf(a.toUpperCase());
      const indexB = sizeOrder.indexOf(b.toUpperCase());
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [product?.product_variants]);

  // Set default color when product loads
  useMemo(() => {
    if (colors.length > 0 && !selectedColor) {
      setSelectedColor(colors[0]);
    }
  }, [colors, selectedColor]);

  // Check if a size is available for the selected color
  const isSizeAvailable = (size: string) => {
    if (!product?.product_variants) return false;
    const variant = product.product_variants.find(v => 
      v.size === size && 
      (colors.length === 0 || v.color === selectedColor)
    );
    return variant && variant.stock_qty > 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <StoreHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <StoreHeader />
        <div className="container py-20 text-center">
          <h1 className="font-display text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-4">O produto que você está procurando não existe ou foi removido.</p>
          <Link to="/">
            <Button>Voltar para o catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  const selectedVariant = product.product_variants?.find(v => 
    v.size === selectedSize && 
    (colors.length === 0 || v.color === selectedColor)
  );
  const maxQuantity = selectedVariant?.stock_qty || 0;
  const totalStock = product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  const isOutOfStock = totalStock === 0;

  const subtotal = product.price_cents * quantity;
  const shippingCost = selectedShipping?.price || 0;
  const total = subtotal + shippingCost;

  const canOrder = selectedSize && quantity > 0 && !isOutOfStock;

  const generateOrderMessage = () => {
    const colorText = selectedColor ? ` (${selectedColor})` : '';
    let message = `Olá! Quero comprar:\n\n`;
    message += `• Produto: ${product.name}\n`;
    message += `• Tamanho: ${selectedSize}${colorText} | Qtd: ${quantity}\n`;
    message += `• Subtotal: ${formatPrice(subtotal)}\n`;
    
    if (selectedShipping) {
      message += `• Frete: ${selectedShipping.service} (${formatPrice(selectedShipping.price)} – ${selectedShipping.deadline} dias)\n`;
    }
    
    if (cep) {
      message += `• CEP: ${cep}\n`;
    }
    
    message += `• Total: ${formatPrice(total)}\n`;
    message += `\nLink: ${window.location.href}`;
    
    return message;
  };

  const handleWhatsAppOrder = async () => {
    if (!canOrder || !settings?.seller_whatsapp) return;
    
    setIsSubmitting(true);
    
    try {
      // Create order intent
      const order = await createOrderIntent({
        dest_cep: cep || null,
        shipping_service: selectedShipping?.service || null,
        shipping_price_cents: selectedShipping?.price || null,
        shipping_deadline_days: selectedShipping?.deadline || null,
        subtotal_cents: subtotal,
        total_cents: total,
        status: 'NOVO',
      });

      // Create order item
      await createOrderItem({
        order_intent_id: order.id,
        product_id: product.id,
        variant_id: selectedVariant?.id || null,
        product_name: product.name,
        size: selectedSize!,
        qty: quantity,
        unit_price_cents: product.price_cents,
        line_total_cents: subtotal,
      });

      // Open WhatsApp
      const message = generateOrderMessage();
      const link = getWhatsAppLink(settings.seller_whatsapp, message);
      window.open(link, '_blank');
    } catch (error) {
      console.error('Error creating order:', error);
      // Still open WhatsApp even if order creation fails
      const message = generateOrderMessage();
      const link = getWhatsAppLink(settings?.seller_whatsapp || '', message);
      window.open(link, '_blank');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyOrderText = () => {
    const message = generateOrderMessage();
    navigator.clipboard.writeText(message);
    toast({
      title: 'Copiado!',
      description: 'Texto do pedido copiado para a área de transferência.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />

      <main className="container py-6">
        {/* Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Gallery */}
          <ProductGallery 
            images={product.product_images || []}
            mainImage={product.main_image_url}
            productName={product.name}
          />

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category */}
            {product.categories && (
              <Badge variant="secondary">{product.categories.name}</Badge>
            )}

            {/* Name & Price */}
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">{product.name}</h1>
              <p className="text-2xl font-semibold mt-2">{formatPrice(product.price_cents)}</p>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground">{product.description}</p>
            )}

            {/* Color Selector */}
            {colors.length > 0 && (
              <div className="space-y-3">
                <Label className="font-medium">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cor: {selectedColor && <span className="text-foreground capitalize">{selectedColor}</span>}
                  </span>
                </Label>
                <div className="flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColor(color);
                        setSelectedSize(null);
                      }}
                      className={cn(
                        "relative w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 transition-all touch-manipulation flex items-center justify-center",
                        selectedColor === color ? "ring-2 ring-offset-2 ring-green-500 scale-110" : "ring-0"
                      )}
                      style={{ 
                        backgroundColor: getColorHex(color),
                        borderColor: color.toLowerCase() === 'branco' ? '#e5e7eb' : getColorHex(color)
                      }}
                      title={color}
                    >
                      {selectedColor === color && (
                        <Check className={cn(
                          "h-5 w-5",
                          ['branco', 'amarelo', 'bege'].includes(color.toLowerCase()) ? "text-gray-800" : "text-white"
                        )} strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            <div className="space-y-3">
              <Label className="font-medium">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tamanho: {selectedSize && <span className="text-foreground">{selectedSize}</span>}
                </span>
                {selectedSize && selectedVariant && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({selectedVariant.stock_qty} em estoque)
                  </span>
                )}
              </Label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const available = isSizeAvailable(size);
                  return (
                    <button
                      key={size}
                      onClick={() => available && setSelectedSize(size)}
                      disabled={!available}
                      className={cn(
                        "min-w-[52px] h-12 sm:min-w-[56px] sm:h-14 px-4 text-base font-medium rounded-lg border-2 transition-all touch-manipulation",
                        selectedSize === size 
                          ? "bg-primary text-primary-foreground border-primary scale-105" 
                          : available
                            ? "bg-background border-border hover:border-primary active:scale-95"
                            : "bg-muted text-muted-foreground border-transparent line-through cursor-not-allowed opacity-50"
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-3">
              <Label className="font-medium">Quantidade</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={maxQuantity || 99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(maxQuantity || 99, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={quantity >= maxQuantity}
                  onClick={() => setQuantity(q => Math.min(maxQuantity || 99, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Shipping Calculator */}
            <div className="border-t pt-6">
              <ShippingCalculator
                weightGrams={product.weight_grams}
                selectedOption={selectedShipping}
                onSelectOption={setSelectedShipping}
                onCepChange={setCep}
              />
            </div>

            {/* Order Summary */}
            <div className="border-t pt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {selectedShipping && (
                <div className="flex justify-between text-sm">
                  <span>Frete ({selectedShipping.service})</span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1 h-14 bg-whatsapp hover:bg-whatsapp/90 text-whatsapp-foreground"
                disabled={!canOrder || isSubmitting}
                onClick={handleWhatsAppOrder}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                )}
                Finalizar pelo WhatsApp
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                disabled={!canOrder}
                onClick={copyOrderText}
              >
                <Copy className="h-5 w-5 mr-2" />
                Copiar pedido
              </Button>
            </div>

            {!selectedSize && (
              <p className="text-sm text-muted-foreground text-center">
                Selecione um tamanho para continuar
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Floating WhatsApp Button */}
      <WhatsAppButton floating />
    </div>
  );
};

export default ProductPage;
