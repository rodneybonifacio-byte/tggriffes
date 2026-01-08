import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProducts } from '@/hooks/useProducts';
import { useOrderIntents } from '@/hooks/useOrders';
import { Package, ShoppingCart, AlertTriangle, TrendingUp, User } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrderIntents();

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

  const today = new Date().toDateString();
  
  const todayOrders = orders.filter(o => 
    new Date(o.created_at).toDateString() === today
  );

  // Vendas do dia (pedidos de hoje com status FINALIZADO)
  const todaySales = todayOrders.filter(o => o.status === 'FINALIZADO');
  const todayRevenue = todaySales.reduce((sum, o) => sum + o.total_cents, 0);

  // Vendas fechadas (total FINALIZADO)
  const closedOrders = orders.filter(o => o.status === 'FINALIZADO');
  const closedRevenue = closedOrders.reduce((sum, o) => sum + o.total_cents, 0);

  // Vendas canceladas
  const cancelledOrders = orders.filter(o => o.status === 'CANCELADO');
  const cancelledTotal = cancelledOrders.reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <AdminGuard>
      <AdminLayout title="Dashboard">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
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
                Pedidos Hoje
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

          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-600">
                Vendas Hoje
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatPrice(todayRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {todaySales.length} pedidos finalizados
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
                          {formatPrice(order.total_cents)} • {new Date(order.created_at).toLocaleString('pt-BR', {
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
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDashboard;
