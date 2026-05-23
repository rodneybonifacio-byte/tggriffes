import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CustomerBehaviorCard } from '@/components/admin/CustomerBehaviorCard';
import { TopCustomersCard } from '@/components/admin/TopCustomersCard';
import { useProducts } from '@/hooks/useProducts';
import { useOrderIntents } from '@/hooks/useOrders';
import { usePermissions } from '@/hooks/usePermissions';
import { Package, ShoppingCart, AlertTriangle, TrendingUp, User } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  all: 'Tudo',
  custom: 'Personalizado',
};

const AdminDashboard = () => {
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrderIntents();
  const { canViewPrices, isLoading: permissionsLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  // Enquanto carrega permissões, NÃO exibimos valores sensíveis.
  const showPrices = permissionsLoading ? false : canViewPrices;

  const activeProducts = products.filter(p => p.active);
  
  // Get individual variants with low stock (1-3 units)
  const lowStockVariants = products.flatMap(product => 
    (product.product_variants || [])
      .filter(v => v.stock_qty > 0 && v.stock_qty <= 3)
      .map(variant => ({
        ...variant,
        productName: product.name,
        productImage: product.main_image_url,
        productId: product.id,
      }))
  );

  // Get individual variants with zero stock
  const outOfStockVariants = products.flatMap(product => 
    (product.product_variants || [])
      .filter(v => v.stock_qty === 0)
      .map(variant => ({
        ...variant,
        productName: product.name,
        productImage: product.main_image_url,
        productId: product.id,
      }))
  );

  // Janela do filtro selecionado
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return { periodStart: d, periodEnd: null as Date | null };
    }
    if (period === '7d') return { periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), periodEnd: null };
    if (period === '30d') return { periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), periodEnd: null };
    if (period === 'custom' && customRange?.from) {
      const from = new Date(customRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(customRange.to ?? customRange.from);
      to.setHours(23, 59, 59, 999);
      return { periodStart: from, periodEnd: to };
    }
    return { periodStart: null as Date | null, periodEnd: null as Date | null };
  }, [period, customRange]);

  const filteredOrders = useMemo(() => {
    if (!periodStart) return orders;
    return orders.filter(o => {
      const d = new Date(o.created_at);
      if (d < periodStart) return false;
      if (periodEnd && d > periodEnd) return false;
      return true;
    });
  }, [orders, periodStart, periodEnd]);

  const periodLabel = PERIOD_LABELS[period].toLowerCase();

  // Pedidos no período
  const todayOrders = filteredOrders;
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total_cents, 0);

  // Vendas acumuladas (não cancelados) no período
  const activeOrders = filteredOrders.filter(o => o.status !== 'CANCELADO');
  const accumulatedRevenue = activeOrders.reduce((sum, o) => sum + o.total_cents, 0);

  // Vendas finalizadas no período
  const closedOrders = filteredOrders.filter(o => o.status === 'FINALIZADO');
  const closedRevenue = closedOrders.reduce((sum, o) => sum + o.total_cents, 0);

  // Vendas canceladas no período
  const cancelledOrders = filteredOrders.filter(o => o.status === 'CANCELADO');
  const cancelledTotal = cancelledOrders.reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <AdminGuard>
      <AdminLayout title="Dashboard">
        {/* Period Filter */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Período:</span>
          {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={period === 'custom' ? 'default' : 'outline'}
                className={cn('justify-start text-left font-normal')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {period === 'custom' && customRange?.from ? (
                  customRange.to ? (
                    <>
                      {format(customRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                      {format(customRange.to, 'dd/MM/yy', { locale: ptBR })}
                    </>
                  ) : (
                    format(customRange.from, 'dd/MM/yy', { locale: ptBR })
                  )
                ) : (
                  <span>Personalizado</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={customRange?.from}
                selected={customRange}
                onSelect={(range) => {
                  setCustomRange(range);
                  if (range?.from) setPeriod('custom');
                }}
                numberOfMonths={2}
                locale={ptBR}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Stats Cards */}
        <div className={`grid gap-4 md:grid-cols-2 ${showPrices ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'} mb-8`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Produtos Ativos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                {products.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos ({PERIOD_LABELS[period]})
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                {orders.length} total
              </p>
            </CardContent>
          </Card>

          {showPrices && (
            <>
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-green-600">
                    Vendas {PERIOD_LABELS[period]}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatPrice(todayRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    {todayOrders.length} pedidos {periodLabel}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-blue-600">
                    Vendas Ativas
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatPrice(accumulatedRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeOrders.length} pedidos ativos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-primary">
                    Vendas Finalizadas
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatPrice(closedRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    {closedOrders.length} pedidos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-destructive">
                    Cancelados
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{formatPrice(cancelledTotal)}</div>
                  <p className="text-xs text-muted-foreground">
                    {cancelledOrders.length} pedidos
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Estoque Baixo
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{lowStockVariants.length}</div>
              <p className="text-xs text-muted-foreground">
                {outOfStockVariants.length} sem estoque
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Low Stock Variants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Variantes com Estoque Baixo</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockVariants.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma variante com estoque baixo</p>
              ) : (
                <div className="space-y-3">
                  {lowStockVariants.slice(0, 6).map((variant) => (
                    <Link 
                      key={variant.id}
                      to={`/admin/produtos/${variant.productId}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {variant.productImage ? (
                          <img 
                            src={variant.productImage} 
                            alt={variant.productName}
                            className="h-10 w-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{variant.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            Tam: {variant.size}
                            {variant.color && ` • Cor: ${variant.color}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-warning font-medium">
                        {variant.stock_qty} un.
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pedidos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground">Nenhum pedido ainda</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <Link 
                      key={order.id}
                      to="/admin/pedidos"
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <span className="text-primary font-semibold">#{order.order_number}</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {order.customer_name || 'Cliente não informado'}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {showPrices && `${formatPrice(order.total_cents)} • `}
                          {new Date(order.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'NOVO' ? 'bg-primary/10 text-primary' :
                        order.status === 'FECHADO' ? 'bg-success/10 text-success' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {order.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Customers + Customer Behavior */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <TopCustomersCard />
          {showPrices && <CustomerBehaviorCard />}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDashboard;
