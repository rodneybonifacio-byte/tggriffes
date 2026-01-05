import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StoreHeader } from '@/components/store/StoreHeader';
import { ProductGallery } from '@/components/store/ProductGallery';

import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { useProductBySlug } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Minus, Plus, Loader2, Check, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';

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
  vinho: '#722f37',
  bordo: '#800020',
  burgundy: '#800020',
  navy: '#000080',
  marinho: '#000080',
  creme: '#fffdd0',
  offwhite: '#faf9f6',
  'off-white': '#faf9f6',
  caramelo: '#a0522d',
  mostarda: '#e4a010',
  oliva: '#808000',
  coral: '#ff7f50',
  salmao: '#fa8072',
  salmon: '#fa8072',
  turquesa: '#40e0d0',
  aqua: '#00ffff',
  lilas: '#c8a2c8',
  lavanda: '#e6e6fa',
  grafite: '#474747',
  chumbo: '#4a4a4a',
  nude: '#e3bc9a',
  terracota: '#e2725b',
  pessego: '#ffcba4',
  menta: '#98ff98',
  oceano: '#1e90ff',
  jeans: '#4169e1',
  cafe: '#6f4e37',
  chocolate: '#7b3f00',
  ouro: '#ffd700',
  prata: '#c0c0c0',
  bronze: '#cd7f32',
  cobre: '#b87333',
};

// Check if a color is light (needs dark border)
const isLightColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
};

// Try to find color by partial match
const findColorHex = (colorName: string): string => {
  const normalized = colorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
  
  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
  
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return '#888888';
};

const getColorHex = (colorName: string) => {
  return findColorHex(colorName);
};

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProductBySlug(slug);
  const { toast } = useToast();
  const { addItem } = useCart();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

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

  const canAddToCart = selectedSize && quantity > 0 && !isOutOfStock && selectedVariant;

  const handleAddToCart = () => {
    if (!canAddToCart || !selectedVariant) return;
    
    addItem({
      productId: product.id,
      productName: product.name,
      variantId: selectedVariant.id,
      size: selectedSize,
      color: selectedColor,
      quantity,
      unitPriceCents: product.price_cents,
      imageUrl: product.main_image_url,
    });
    
    toast({
      title: 'Adicionado ao carrinho!',
      description: `${product.name} (${selectedSize}${selectedColor ? ` - ${selectedColor}` : ''}) x${quantity}`,
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
                        borderColor: isLightColor(getColorHex(color)) ? '#1f2937' : getColorHex(color)
                      }}
                      title={color}
                    >
                      {selectedColor === color && (
                        <Check className={cn(
                          "h-5 w-5",
                          isLightColor(getColorHex(color)) ? "text-gray-800" : "text-white"
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

            {/* Order Summary */}
            <div className="border-t pt-6 space-y-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              className="w-full h-14"
              disabled={!canAddToCart}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Adicionar ao carrinho
            </Button>

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
