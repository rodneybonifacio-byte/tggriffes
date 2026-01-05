import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductVariant } from '@/hooks/useProducts';

interface SizeSelectorProps {
  variants: ProductVariant[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
}

export function SizeSelector({ variants, selectedSize, onSelect }: SizeSelectorProps) {
  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
  
  const sortedVariants = [...variants].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size.toUpperCase());
    const indexB = sizeOrder.indexOf(b.size.toUpperCase());
    if (indexA === -1 && indexB === -1) return a.size.localeCompare(b.size);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="flex flex-wrap gap-2">
      {sortedVariants.map((variant) => {
        const isSelected = selectedSize === variant.size;
        const isOutOfStock = variant.stock_qty === 0;
        
        return (
          <button
            key={variant.id}
            onClick={() => !isOutOfStock && onSelect(variant.size)}
            disabled={isOutOfStock}
            className={cn(
              "relative min-w-[48px] h-12 px-4 rounded-lg border text-sm font-medium transition-all",
              isSelected && "border-primary bg-primary text-primary-foreground",
              !isSelected && !isOutOfStock && "border-border hover:border-primary",
              isOutOfStock && "border-border/50 text-muted-foreground/50 cursor-not-allowed line-through"
            )}
          >
            {variant.size}
            {isSelected && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-success flex items-center justify-center">
                <Check className="h-3 w-3 text-success-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
