import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '@/hooks/useProducts';
import { formatPrice, getColorDisplayName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

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

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { addItem, getQuantityForVariant, items, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();

  const openProduct = () => navigate(`/produto/${product.slug}`);
  
  const variants = product.product_variants || [];
  const images = product.product_images || [];
  const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0);
  const isOutOfStock = totalStock === 0;

  // Build images array (main + gallery)
  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (product.main_image_url) imgs.push(product.main_image_url);
    images
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(img => {
        if (!imgs.includes(img.image_url)) imgs.push(img.image_url);
      });
    return imgs;
  }, [product.main_image_url, images]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);


  // Get unique colors sorted alphabetically
  const colors = useMemo(() => {
    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[];
    return uniqueColors.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [variants]);

  const sizes = useMemo(() => {
    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const uniqueSizes = [...new Set(variants.map(v => v.size))];
    return uniqueSizes.sort((a, b) => {
      const indexA = sizeOrder.indexOf(a.toUpperCase());
      const indexB = sizeOrder.indexOf(b.toUpperCase());
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [variants]);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  // Get variant for a specific color and size
  const getVariant = (color: string | null, size: string) => {
    return variants.find(v => v.size === size && v.color === color);
  };


  // Add to cart directly
  const handleAddToCart = (e: React.MouseEvent, color: string | null, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const variant = getVariant(color, size);
    if (!variant) return;
    
    const result = addItem({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      size: size,
      color: color,
      quantity: 1,
      unitPriceCents: product.price_cents,
      imageUrl: product.main_image_url,
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
  };

  // Remove from cart
  const handleRemoveFromCart = (e: React.MouseEvent, color: string | null, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    
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

  const getColorHex = (colorName: string) => {
    return findColorHex(colorName);
  };

  return (
    <div className="group block animate-fade-in bg-card rounded-xl border border-border/50 p-1.5 pb-2 shadow-sm">
      {/* Image - clickable to product page (iOS-safe) */}
      <div
        role="link"
        tabIndex={0}
        aria-label={`Abrir ${product.name}`}
        onClick={openProduct}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProduct();
          }
        }}
        className="relative aspect-square overflow-hidden rounded-lg bg-secondary cursor-pointer"
      >

        {allImages.length > 0 ? (
          <img
            src={allImages[currentImageIndex]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Navigation arrows - only on desktop hover */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute z-20 left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hidden sm:flex"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute z-20 right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hidden sm:flex"
            >
              <ChevronRight className="h-3 w-3" />
            </button>

            {/* Dots indicator */}
            <div className="absolute z-20 bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
              {allImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={cn(
                    "w-1 h-1 rounded-full transition-all",
                    idx === currentImageIndex ? "bg-white w-2" : "bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {isOutOfStock && (
          <div className="pointer-events-none absolute z-20 inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary" className="bg-background text-[10px]">
              Esgotado
            </Badge>
          </div>
        )}
      </div>
      
      <div className="mt-1.5 space-y-1 text-center">
        <button type="button" onClick={openProduct} className="w-full">
          <h3 className="text-[11px] sm:text-xs font-medium line-clamp-2 leading-tight group-hover:text-primary/80 transition-colors">
            {product.name}
          </h3>
        </button>
        <p className="text-xs sm:text-sm font-semibold">
          {formatPrice(product.price_cents)}
        </p>

        {!isOutOfStock && sizes.length > 0 && (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Variantes organizadas por cor (agrupadas) */}
            <div className="space-y-1">
              {(() => {
                // Build items array sorted by color first, then by size
                const items = colors.length > 0
                  ? colors.flatMap((color) =>
                      sizes.map((size) => {
                        const variant = getVariant(color, size);
                        if (!variant) return null;
                        return { color, size, variant };
                      }).filter(Boolean)
                    )
                  : sizes.map((size) => {
                      const variant = variants.find((v) => v.size === size);
                      if (!variant) return null;
                      return { color: null as string | null, size, variant };
                    }).filter(Boolean);

                return items.map((item) => {
                  if (!item) return null;
                  const { color, size, variant } = item;

                  const quantityInCart = getQuantityForVariant(variant.id);
                  const remaining = Math.max(0, variant.stock_qty - quantityInCart);

                  const colorHex = color ? findColorHex(color) : null;
                  const needsBorder = colorHex ? isLightColor(colorHex) : false;

                  const isLastOne = remaining === 1;
                  const isLowStock = remaining > 1 && remaining <= 3;
                  const isMaxed = remaining === 0 && quantityInCart > 0;
                  const isSoldOut = variant.stock_qty === 0 && quantityInCart === 0;

                  const rowTone = (() => {
                    if (quantityInCart > 0) return "border-success/40 bg-success/10";
                    if (isLastOne) return "border-destructive/40 bg-destructive/10";
                    if (isLowStock) return "border-warning/40 bg-warning/10";
                    if (isSoldOut) return "border-border/40 bg-muted/60 opacity-70";
                    return "border-border/60 bg-card";
                  })();

                  const stockLabel = (() => {
                    if (remaining === 0) return isMaxed ? "Máx!" : "0";
                    if (remaining === 1) return "🔥 1";
                    if (remaining <= 3) return `⚡ ${remaining}`;
                    return `${remaining}`;
                  })();

                  const stockColor = (() => {
                    if (remaining === 0) return isMaxed ? "text-amber-600 font-bold" : "text-muted-foreground";
                    if (remaining === 1) return "text-red-600 font-bold";
                    if (remaining <= 3) return "text-amber-600 font-semibold";
                    return "text-emerald-600 font-semibold";
                  })();

                  const handleAdd = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddToCart(e, color, size);
                  };

                  const handleRemove = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveFromCart(e, color, size);
                  };

                  return (
                    <div
                      key={`${color || "default"}-${size}`}
                      className={cn(
                        "flex items-center justify-between min-h-9 rounded-md border px-1.5 py-1 transition-colors",
                        rowTone
                      )}
                    >
                      {/* Left: swatch + tamanho + estoque inline */}
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {colorHex && (
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full shrink-0",
                              needsBorder && "border border-border"
                            )}
                            style={{ backgroundColor: colorHex }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-[11px] font-bold shrink-0">{size}</span>
                        <span 
                          key={remaining}
                          className={cn("text-[10px] truncate animate-pop", stockColor)}
                        >
                          {stockLabel}
                        </span>
                      </div>

                      {/* Right: controles compactos */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {quantityInCart > 0 && (
                          <>
                            <button
                              onClick={handleRemove}
                              className="w-6 h-6 rounded-full bg-destructive/15 text-destructive flex items-center justify-center active:scale-95 transition-transform"
                              aria-label="Remover"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-4 text-center text-[11px] font-bold text-success">
                              {quantityInCart}
                            </span>
                          </>
                        )}
                        <button
                          onClick={handleAdd}
                          disabled={remaining === 0}
                          className={cn(
                            "w-6 h-6 rounded-full bg-success text-success-foreground flex items-center justify-center active:scale-95 transition-transform",
                            "disabled:bg-muted disabled:text-muted-foreground"
                          )}
                          aria-label="Adicionar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}