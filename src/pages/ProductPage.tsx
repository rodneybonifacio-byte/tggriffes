import { useMemo, useRef, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { StoreHeader } from '@/components/store/StoreHeader';
import { ProductGallery } from '@/components/store/ProductGallery';

import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { useProductBySlug, useProducts } from '@/hooks/useProducts';
import { formatPrice, getColorDisplayName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Minus, Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
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
  off: '#f5f5dc',
  offwhite: '#f5f5dc',
  'off-white': '#f5f5dc',
  'off white': '#f5f5dc',
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
  const { data: allProducts } = useProducts({ status: 'active' });
  const { toast } = useToast();
  const { addItem, getQuantityForVariant, items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  
  // Swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // Get current product index and neighbors
  const currentIndex = useMemo(() => {
    if (!allProducts || !product) return -1;
    return allProducts.findIndex(p => p.id === product.id);
  }, [allProducts, product]);
  
  const prevProduct = currentIndex > 0 ? allProducts?.[currentIndex - 1] : null;
  const nextProduct = currentIndex >= 0 && currentIndex < (allProducts?.length || 0) - 1 
    ? allProducts?.[currentIndex + 1] 
    : null;
  
  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    
    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0 && nextProduct) {
        // Swipe left - go to next
        setSwipeDirection('left');
        setTimeout(() => {
          navigate(`/produto/${nextProduct.slug}`);
        }, 150);
      } else if (diff < 0 && prevProduct) {
        // Swipe right - go to previous
        setSwipeDirection('right');
        setTimeout(() => {
          navigate(`/produto/${prevProduct.slug}`);
        }, 150);
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };
  
  // Reset swipe direction when product changes
  useEffect(() => {
    setSwipeDirection(null);
  }, [slug]);

  // Track expanded cell for +/- controls
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  // Track pending mutations to prevent rapid clicks
  const [pendingVariants, setPendingVariants] = useState<Set<string>>(new Set());

  // Reset expanded cell when product changes
  useEffect(() => {
    setExpandedCell(null);
    setPendingVariants(new Set());
  }, [slug]);

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

  // Get variant for a specific color and size
  const getVariant = (color: string | null, size: string) => {
    if (!product?.product_variants) return null;
    return product.product_variants.find(v => 
      v.size === size && v.color === color
    );
  };

  // Check if a color+size is available
  const isVariantAvailable = (color: string | null, size: string) => {
    const variant = getVariant(color, size);
    return variant && variant.stock_qty > 0;
  };

  // Add to cart directly (with pending lock)
  const handleAddToCart = async (color: string | null, size: string) => {
    const variant = getVariant(color, size);
    if (!variant || !product) return;
    
    // Block if already pending for this variant
    if (pendingVariants.has(variant.id)) return;
    
    setPendingVariants(prev => new Set(prev).add(variant.id));
    
    try {
      const result = await addItem({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        size: size,
        color: color,
        quantity: 1,
        unitPriceCents: product.price_cents,
        imageUrl: product.main_image_url,
        category: product.categories?.name || null,
      }, variant.stock_qty);
      
      if (result.success) {
        toast({
          title: 'Adicionado!',
          description: `${product.name} - ${size}${color ? ` (${getColorDisplayName(color)})` : ''}`,
        });
      } else {
        toast({
          title: 'Limite atingido',
          description: result.message,
          variant: 'destructive',
        });
      }
    } finally {
      setPendingVariants(prev => {
        const next = new Set(prev);
        next.delete(variant.id);
        return next;
      });
    }
  };

  // Remove from cart
  const handleRemoveFromCart = (color: string | null, size: string) => {
    const variant = getVariant(color, size);
    if (!variant) return;
    
    const cartItem = items.find(i => i.variantId === variant.id);
    if (!cartItem) return;
    
    if (cartItem.quantity <= 1) {
      removeItem(cartItem.id);
    } else {
      updateQuantity(cartItem.id, cartItem.quantity - 1);
    }
    
    toast({
      title: 'Removido',
      description: `${product.name} - ${size}${color ? ` (${getColorDisplayName(color)})` : ''}`,
    });
  };

  const totalStock = product?.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  const isOutOfStock = totalStock === 0;

  // Loading state
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

  // Not found state
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

  return (
    <div 
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <StoreHeader />

      <main className={cn(
        "container py-6 transition-all duration-150",
        swipeDirection === 'left' && "opacity-50 translate-x-[-20px]",
        swipeDirection === 'right' && "opacity-50 translate-x-[20px]"
      )}>
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>
          
          {/* Navigation arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevProduct && navigate(`/produto/${prevProduct.slug}`)}
              disabled={!prevProduct}
              className={cn(
                "p-2 rounded-full border transition-colors",
                prevProduct 
                  ? "hover:bg-muted active:scale-95" 
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted-foreground">
              {currentIndex >= 0 ? `${currentIndex + 1}/${allProducts?.length || 0}` : ''}
            </span>
            <button
              onClick={() => nextProduct && navigate(`/produto/${nextProduct.slug}`)}
              disabled={!nextProduct}
              className={cn(
                "p-2 rounded-full border transition-colors",
                nextProduct 
                  ? "hover:bg-muted active:scale-95" 
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

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

            {/* Name */}
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">{product.name}</h1>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground">{product.description}</p>
            )}

            {/* Instruction */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">ATENÇÃO!</span> Aperte no + para adicionar ao carrinho.
              </p>
            </div>

            {/* Size Grid Table with Colors as Rows */}
            <div className="border rounded-lg overflow-hidden">
              {/* Header - Sizes */}
              <div 
                className="grid border-b bg-muted/30" 
                style={{ gridTemplateColumns: colors.length > 0 ? `60px repeat(${sizes.length}, 1fr)` : `repeat(${sizes.length}, 1fr)` }}
              >
                {colors.length > 0 && (
                  <div className="py-3 border-r flex items-center justify-center text-xs text-muted-foreground font-medium">
                    Cor
                  </div>
                )}
                {sizes.map((size) => (
                  <div key={size} className="text-center py-3 font-medium text-sm border-r last:border-r-0">
                    {size}
                  </div>
                ))}
              </div>
              
              {/* Rows - One per color (or single row if no colors) */}
              {(colors.length > 0 ? colors : [null]).map((color) => (
                <div 
                  key={color || 'default'} 
                  className="grid border-b last:border-b-0"
                  style={{ gridTemplateColumns: colors.length > 0 ? `60px repeat(${sizes.length}, 1fr)` : `repeat(${sizes.length}, 1fr)` }}
                >
                  {/* Color swatch */}
                  {colors.length > 0 && color && (
                    <div className="flex items-center justify-center py-4 border-r">
                      <div 
                        className="w-8 h-8 rounded-full border-2"
                        style={{ 
                          backgroundColor: getColorHex(color),
                          borderColor: isLightColor(getColorHex(color)) ? '#1f2937' : getColorHex(color)
                        }}
                        title={getColorDisplayName(color)}
                      />
                    </div>
                  )}
                  
                  {/* Size buttons for this color */}
                  {sizes.map((size) => {
                    const available = isVariantAvailable(color, size);
                    const variant = getVariant(color, size);
                    const quantityInCart = variant ? getQuantityForVariant(variant.id) : 0;
                    const cellKey = `${color || ''}|${size}`;
                    const isExpanded = expandedCell === cellKey;
                    
                    return (
                      <div 
                        key={size} 
                        className={cn(
                          "flex flex-col items-center justify-center py-3 border-r last:border-r-0 min-h-[80px]",
                          !available && "bg-muted/50"
                        )}
                      >
                        {available ? (
                          <>
                            {quantityInCart > 0 ? (
                              isExpanded ? (
                                // Expanded: show +/- controls
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      handleRemoveFromCart(color, size);
                                      const newQty = quantityInCart - 1;
                                      if (newQty <= 0) setExpandedCell(null);
                                    }}
                                    className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center transition-all active:scale-90 active:bg-red-200"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-bold text-green-600">
                                    {quantityInCart}
                                  </span>
                                  <button
                                    onClick={() => handleAddToCart(color, size)}
                                    disabled={pendingVariants.has(variant?.id || '')}
                                    className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center transition-all active:scale-90 active:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                // Collapsed: show quantity badge
                                <button
                                  onClick={() => setExpandedCell(cellKey)}
                                  className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                >
                                  {quantityInCart}
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => handleAddToCart(color, size)}
                                disabled={pendingVariants.has(variant?.id || '')}
                                className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-green-500 hover:bg-green-50 hover:text-green-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            )}
                            {/* Stock indicator - shows remaining after cart */}
                            {variant && (() => {
                              const remaining = variant.stock_qty - quantityInCart;
                              if (remaining === 0) {
                                return (
                                  <span className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-semibold">
                                    Esgotado
                                  </span>
                                );
                              }
                              if (remaining === 1) {
                                return (
                                  <span className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold animate-pulse">
                                    🔥 Última peça!
                                  </span>
                                );
                              }
                              if (remaining <= 3) {
                                return (
                                  <span className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                                    ⚡ Só {remaining} restam
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                  ✓ {remaining} disponíveis
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Continuar comprando button */}
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Continuar comprando
              </Button>
            </Link>

          </div>
        </div>
      </main>

      {/* Floating WhatsApp Button */}
      <WhatsAppButton floating />
    </div>
  );
};

export default ProductPage;
