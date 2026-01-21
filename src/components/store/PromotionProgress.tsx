import { Package, Flame } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useApplicablePromotions } from '@/hooks/usePromotions';
import { formatPrice } from '@/lib/utils';

interface PromotionProgressProps {
  totalItems: number;
}

export function PromotionProgress({ totalItems }: PromotionProgressProps) {
  // Fetch promotions with a high quantity to get the threshold
  const { data: promotion } = useApplicablePromotions(999);

  if (!promotion || totalItems >= promotion.min_quantity) {
    return null;
  }

  const remaining = promotion.min_quantity - totalItems;
  const progressPercent = (totalItems / promotion.min_quantity) * 100;

  // Get discount price for display
  const discountPrice = promotion.discount_type === 'fixed_price' 
    ? formatPrice(promotion.discount_value * 100)
    : null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-100 rounded-full">
          <Package className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Faltam <span className="font-bold text-orange-600">{remaining} {remaining === 1 ? 'peça' : 'peças'}</span> para atacado!
          </p>
          {discountPrice && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Cada peça por apenas {discountPrice}
            </p>
          )}
        </div>
      </div>
      
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2 bg-amber-100" />
        <div className="flex justify-between text-xs text-amber-600">
          <span>{totalItems} {totalItems === 1 ? 'peça' : 'peças'}</span>
          <span>{promotion.min_quantity} peças</span>
        </div>
      </div>
    </div>
  );
}
