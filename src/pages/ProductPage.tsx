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

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  // Track quantities per size
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});

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

  // Get variant for a specific size
  const getVariant = (size: string) => {
    if (!product?.product_variants) return null;
    return product.product_variants.find(v => 
      v.size === size && 
      (colors.length === 0 || v.color === selectedColor)
    );
  };

  // Check if a size is available for the selected color
  const isSizeAvailable = (size: string) => {
    const variant = getVariant(size);
    return variant && variant.stock_qty > 0;
  };

  // Get stock for a size
  const getStockForSize = (size: string) => {
    const variant = getVariant(size);
    return variant?.stock_qty || 0;
  };

  // Handle quantity change for a size
  const handleQuantityChange = (size: string, delta: number) => {
    const currentQty = sizeQuantities[size] || 0;
    const maxStock = getStockForSize(size);
    const newQty = Math.max(0, Math.min(maxStock, currentQty + delta));
    setSizeQuantities(prev => ({ ...prev, [size]: newQty }));
  };

  // Calculate totals
  const totalPieces = Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = totalPieces * (product?.price_cents || 0);

  // Get selected items for cart
  const getSelectedItems = () => {
    return Object.entries(sizeQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => ({
        size,
        quantity: qty,
        variant: getVariant(size),
      }));
  };

  const totalStock = product?.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  const isOutOfStock = totalStock === 0;

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
                        setSizeQuantities({});
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

            {/* Instruction */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">ATENÇÃO!</span> Aperte no + para incluir a quantidade de peças desejadas.
              </p>
            </div>

            {/* Size Grid Table */}
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `repeat(${sizes.length}, 1fr)` }}>
                {sizes.map((size) => (
                  <div key={size} className="text-center py-3 font-medium text-sm border-r last:border-r-0">
                    {size}
                  </div>
                ))}
              </div>
              
              {/* Buttons Row */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${sizes.length}, 1fr)` }}>
                {sizes.map((size) => {
                  const available = isSizeAvailable(size);
                  const currentQty = sizeQuantities[size] || 0;
                  const stock = getStockForSize(size);
                  
                  return (
                    <div 
                      key={size} 
                      className={cn(
                        "flex flex-col items-center justify-center py-4 border-r last:border-r-0 min-h-[80px]",
                        !available && "bg-muted/50"
                      )}
                    >
                      {available ? (
                        currentQty > 0 ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleQuantityChange(size, -1)}
                              className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-semibold">{currentQty}</span>
                            <button
                              onClick={() => handleQuantityChange(size, 1)}
                              disabled={currentQty >= stock}
                              className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleQuantityChange(size, 1)}
                            className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Summary */}
            <div className="flex items-center justify-between py-3">
              <span className="text-muted-foreground">
                {totalPieces} {totalPieces === 1 ? 'peça' : 'peças'}
              </span>
              <span className="text-lg font-semibold">{formatPrice(totalPrice)}</span>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              className="w-full h-14"
              disabled={totalPieces === 0 || isOutOfStock}
              onClick={() => {
                const items = getSelectedItems();
                items.forEach(item => {
                  if (item.variant) {
                    addItem({
                      productId: product.id,
                      productName: product.name,
                      variantId: item.variant.id,
                      size: item.size,
                      color: selectedColor,
                      quantity: item.quantity,
                      unitPriceCents: product.price_cents,
                      imageUrl: product.main_image_url,
                    });
                  }
                });
                toast({
                  title: 'Adicionado ao carrinho!',
                  description: `${totalPieces} ${totalPieces === 1 ? 'peça' : 'peças'} de ${product.name}`,
                });
                setSizeQuantities({});
              }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Continuar comprando
            </Button>

            {totalPieces === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Selecione a quantidade desejada para continuar
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
