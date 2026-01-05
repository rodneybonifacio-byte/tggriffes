import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProducts } from '@/hooks/useProducts';
import { useOrderIntents } from '@/hooks/useOrders';
import { Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrderIntents();

  const activeProducts = products.filter(p => p.active);
  const lowStockProducts = products.filter(p => {
    const totalStock = p.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
    return totalStock > 0 && totalStock <= 3;
  });
  const outOfStockProducts = products.filter(p => {
    const totalStock = p.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
    return totalStock === 0;
  });

  const todayOrders = orders.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  });

  const totalRevenue = orders
    .filter(o => o.status === 'FECHADO')
    .reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <AdminGuard>
      <AdminLayout title="Dashboard">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
                {products.length} total cadastrados
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
                {orders.length} total de pedidos
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
              <div className="text-2xl font-bold text-warning">{lowStockProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                {outOfStockProducts.length} sem estoque
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita (Fechados)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {orders.filter(o => o.status === 'FECHADO').length} pedidos fechados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Low Stock Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos com Estoque Baixo</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground">Nenhum produto com estoque baixo</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map((product) => {
                    const totalStock = product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
                    return (
                      <Link 
                        key={product.id}
                        to={`/admin/produtos/${product.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {product.main_image_url ? (
                            <img 
                              src={product.main_image_url} 
                              alt={product.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                        <span className="text-sm text-warning font-medium">
                          {totalStock} un.
                        </span>
                      </Link>
                    );
                  })}
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
                        <p className="font-medium">
                          {formatPrice(order.total_cents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString('pt-BR')}
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
