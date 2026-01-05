import { useState, useMemo, useRef, TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
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
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  
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
  const touchStartX = useRef<number | null>(null);

  // Get unique colors and sizes
  const colors = useMemo(() => {
    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    return uniqueColors as string[];
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

  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] || null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null || allImages.length <= 1) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
    touchStartX.current = null;
  };

  // Get available variant based on selection
  const selectedVariant = useMemo(() => {
    if (!selectedSize) return null;
    return variants.find(v => 
      v.size === selectedSize && 
      (colors.length === 0 || v.color === selectedColor)
    );
  }, [variants, selectedSize, selectedColor, colors.length]);

  const availableStock = selectedVariant?.stock_qty || 0;

  // Check if a size is available for the selected color
  const isSizeAvailable = (size: string) => {
    const variant = variants.find(v => 
      v.size === size && 
      (colors.length === 0 || v.color === selectedColor)
    );
    return variant && variant.stock_qty > 0;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedVariant) {
      toast({
        title: 'Selecione o tamanho',
        variant: 'destructive',
      });
      return;
    }

    if (quantity > availableStock) {
      toast({
        title: 'Quantidade indisponível',
        description: `Apenas ${availableStock} unidades em estoque.`,
        variant: 'destructive',
      });
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      variantId: selectedVariant.id,
      size: selectedVariant.size,
      color: selectedVariant.color,
      quantity,
      unitPriceCents: product.price_cents,
      imageUrl: product.main_image_url,
    });

    toast({
      title: 'Adicionado ao carrinho!',
      description: `${quantity}x ${product.name} - Tam: ${selectedSize}`,
    });

    // Reset selection
    setSelectedSize(null);
    setQuantity(1);
  };

  const getColorHex = (colorName: string) => {
    return COLOR_MAP[colorName.toLowerCase()] || '#888888';
  };

  return (
    <div className="group block animate-fade-in">
      <div 
        className="relative aspect-square overflow-hidden rounded-xl bg-secondary"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link to={`/produto/${product.slug}`}>
          {allImages.length > 0 ? (
            <img
              src={allImages[currentImageIndex]}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>
        
        {/* Navigation arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            
            {/* Dots indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    idx === currentImageIndex ? "bg-white w-3" : "bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
        
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary" className="bg-background">
              Esgotado
            </Badge>
          </div>
        )}
      </div>
      
      <div className="mt-3 space-y-2">
        <Link to={`/produto/${product.slug}`}>
          <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary/80 transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm font-semibold">
          {formatPrice(product.price_cents)}
        </p>

        {!isOutOfStock && (
          <div className="space-y-2 pt-2" onClick={(e) => e.stopPropagation()}>
            {/* Colors */}
            {colors.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cor: {selectedColor && <span className="text-foreground capitalize">{selectedColor}</span>}
                </span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedColor(color);
                        setSelectedSize(null);
                      }}
                      className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 transition-all touch-manipulation",
                        selectedColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "ring-0"
                      )}
                      style={{ 
                        backgroundColor: getColorHex(color),
                        borderColor: color.toLowerCase() === 'branco' ? '#e5e7eb' : getColorHex(color)
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tamanho: {selectedSize && <span className="text-foreground">{selectedSize}</span>}
              </span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const available = isSizeAvailable(size);
                  return (
                    <button
                      key={size}
                      onClick={(e) => {
                        e.preventDefault();
                        if (available) setSelectedSize(size);
                      }}
                      disabled={!available}
                      className={cn(
                        "min-w-[44px] h-10 sm:min-w-[48px] sm:h-11 px-3 text-sm font-medium rounded-lg border-2 transition-all touch-manipulation",
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

            {/* Quantity + Add to Cart */}
            {selectedSize && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center border rounded">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setQuantity(Math.max(1, quantity - 1));
                    }}
                    className="p-1 hover:bg-secondary"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-2 text-sm min-w-[24px] text-center">{quantity}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setQuantity(Math.min(availableStock, quantity + 1));
                    }}
                    className="p-1 hover:bg-secondary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
