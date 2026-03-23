import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomers } from '@/hooks/useCustomers';
import { usePermissions } from '@/hooks/usePermissions';
import { formatPrice } from '@/lib/utils';
import { Crown, ShoppingBag, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TopCustomersCard() {
  const { data: customers, isLoading } = useCustomers();
  const { canViewPrices } = usePermissions();

  const topCustomers = (customers || [])
    .filter(c => c.order_count > 0)
    .sort((a, b) => b.order_count - a.order_count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Top Clientes
        </CardTitle>
        <Link to="/admin/clientes" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : topCustomers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente com pedidos ainda</p>
        ) : (
          <div className="space-y-3">
            {topCustomers.map((customer, idx) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                  idx === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                  idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {customer.name || 'Sem nome'}
                    </p>
                    {customer.order_count >= 5 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1.5 py-0">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShoppingBag className="h-3 w-3" />
                    <span>{customer.order_count} {customer.order_count === 1 ? 'pedido' : 'pedidos'}</span>
                    {canViewPrices && (
                      <span className="text-green-600 font-medium">
                        • {formatPrice(customer.total_spent)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
