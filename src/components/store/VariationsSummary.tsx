import { useMemo } from 'react';
import { CartItem } from '@/hooks/useCart';
import { getColorDisplayName } from '@/lib/utils';

interface VariationsSummaryProps {
  items: CartItem[];
}

export function VariationsSummary({ items }: VariationsSummaryProps) {
  const { sizesSummary, colorsSummary, totalPieces } = useMemo(() => {
    const sizesMap = new Map<string, number>();
    const colorsMap = new Map<string, { displayName: string; count: number }>();
    let total = 0;

    for (const item of items) {
      total += item.quantity;
      
      const currentSize = sizesMap.get(item.size) || 0;
      sizesMap.set(item.size, currentSize + item.quantity);
      
      if (item.color) {
        const existing = colorsMap.get(item.color);
        if (existing) {
          existing.count += item.quantity;
        } else {
          colorsMap.set(item.color, {
            displayName: getColorDisplayName(item.color),
            count: item.quantity,
          });
        }
      }
    }

    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'XXGG', 'EG', 'EGG'];
    const sizesSummary = Array.from(sizesMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => {
        const aIndex = sizeOrder.indexOf(a.size.toUpperCase());
        const bIndex = sizeOrder.indexOf(b.size.toUpperCase());
        if (aIndex === -1 && bIndex === -1) return a.size.localeCompare(b.size);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

    const colorsSummary = Array.from(colorsMap.entries())
      .map(([color, data]) => ({ color, ...data }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));

    return { sizesSummary, colorsSummary, totalPieces: total };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Resumo</span>
        <span className="text-sm">
          <span className="font-bold text-lg">{totalPieces}</span>
          <span className="text-muted-foreground ml-1">peças</span>
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sizes */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamanhos</span>
          <div className="space-y-1">
            {sizesSummary.map((item) => (
              <div key={item.size} className="flex items-center justify-between text-sm">
                <span>{item.size}</span>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cores</span>
          <div className="space-y-1">
            {colorsSummary.length > 0 ? (
              colorsSummary.map((item) => (
                <div key={item.color} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[80px]">{item.displayName}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
