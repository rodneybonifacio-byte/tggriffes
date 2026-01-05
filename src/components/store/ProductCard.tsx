import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Check if a color+size is available
  const isVariantAvailable = (color: string | null, size: string) => {
    const variant = getVariant(color, size);
    return variant && variant.stock_qty > 0;
  };

  // Add to cart directly
  const handleAddToCart = (e: React.MouseEvent, color: string | null, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const variant = getVariant(color, size);
    if (!variant) return;
    
    addItem({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      size: size,
      color: color,
      quantity: 1,
      unitPriceCents: product.price_cents,
      imageUrl: product.main_image_url,
    });
    
    toast({
      title: 'Adicionado!',
      description: `${product.name} - ${size}${color ? ` (${color})` : ''}`,
    });
  };

  const getColorHex = (colorName: string) => {
    return findColorHex(colorName);
  };

  return (
    <div className="group block animate-fade-in bg-card rounded-xl border border-border/50 p-1.5 pb-2 shadow-sm">
      {/* Image - clickable to product page */}
      <Link to={`/produto/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
          {allImages.length > 0 ? (
            <img
              src={allImages[currentImageIndex]}
              alt={product.name}
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
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hidden sm:flex"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hidden sm:flex"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
              
              {/* Dots indicator */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
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
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="bg-background text-[10px]">
                Esgotado
              </Badge>
            </div>
          )}
        </div>
      </Link>
      
      <div className="mt-1.5 space-y-1">
        <Link to={`/produto/${product.slug}`}>
          <h3 className="text-[11px] sm:text-xs font-medium line-clamp-2 leading-tight group-hover:text-primary/80 transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-xs sm:text-sm font-semibold">
          {formatPrice(product.price_cents)}
        </p>

        {!isOutOfStock && sizes.length > 0 && (
          <div className="border rounded-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header - Sizes */}
            <div 
              className="grid border-b bg-muted/30" 
              style={{ gridTemplateColumns: colors.length > 0 ? `28px repeat(${sizes.length}, 1fr)` : `repeat(${sizes.length}, 1fr)` }}
            >
              {colors.length > 0 && (
                <div className="py-1 border-r" />
              )}
              {sizes.map((size) => (
                <div key={size} className="text-center py-1 font-medium text-[9px] sm:text-[10px] border-r last:border-r-0">
                  {size}
                </div>
              ))}
            </div>
            
            {/* Rows - One per color (or single row if no colors) */}
            {(colors.length > 0 ? colors : [null]).map((color) => (
              <div 
                key={color || 'default'} 
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: colors.length > 0 ? `28px repeat(${sizes.length}, 1fr)` : `repeat(${sizes.length}, 1fr)` }}
              >
                {/* Color swatch */}
                {colors.length > 0 && color && (
                  <div className="flex items-center justify-center py-1.5 border-r">
                    <div 
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border"
                      style={{ 
                        backgroundColor: getColorHex(color),
                        borderColor: isLightColor(getColorHex(color)) ? '#1f2937' : getColorHex(color)
                      }}
                      title={color}
                    />
                  </div>
                )}
                
                {/* Size buttons for this color */}
                {sizes.map((size) => {
                  const available = isVariantAvailable(color, size);
                  
                  return (
                    <div 
                      key={size} 
                      className={cn(
                        "flex items-center justify-center py-1.5 border-r last:border-r-0",
                        !available && "bg-muted/50"
                      )}
                    >
                      {available ? (
                        <button
                          onClick={(e) => handleAddToCart(e, color, size)}
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-green-500 hover:bg-green-50 hover:text-green-600 transition-all active:scale-90 active:bg-green-100"
                        >
                          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[8px] text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}