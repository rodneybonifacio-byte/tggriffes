import { Package, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { MIN_ORDER_QUANTITY } from '@/lib/commerceRules';

interface PromotionProgressProps {
  totalItems: number;
}

export function PromotionProgress({ totalItems }: PromotionProgressProps) {
  const remaining = Math.max(0, MIN_ORDER_QUANTITY - totalItems);
  const progressPercent = Math.min(100, (totalItems / MIN_ORDER_QUANTITY) * 100);
  const reachedMinimum = remaining === 0;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-primary/10 rounded-full">
          {reachedMinimum ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {reachedMinimum ? 'Pedido mínimo atingido!' : <>Faltam <span className="font-bold text-primary">{remaining} {remaining === 1 ? 'peça' : 'peças'}</span> para finalizar.</>}
          </p>
          <p className="text-xs text-muted-foreground">Todos os produtos por R$ 35,00 cada.</p>
        </div>
      </div>
      
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{totalItems} {totalItems === 1 ? 'peça' : 'peças'}</span>
          <span>{MIN_ORDER_QUANTITY} peças</span>
        </div>
      </div>
    </div>
  );
}
