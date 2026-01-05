import { Link } from 'react-router-dom';
import { Product } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const totalStock = product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  const isOutOfStock = totalStock === 0;

  return (
    <Link 
      to={`/produto/${product.slug}`}
      className="group block animate-fade-in"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
        {product.main_image_url ? (
          <img
            src={product.main_image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary" className="bg-background">
              Esgotado
            </Badge>
          </div>
        )}
      </div>
      
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary/80 transition-colors">
          {product.name}
        </h3>
        <p className="text-sm font-semibold">
          {formatPrice(product.price_cents)}
        </p>
      </div>
    </Link>
  );
}
