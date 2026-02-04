import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrderAnalytics, CustomerBehavior } from '@/hooks/useOrderAnalytics';
import { formatPrice } from '@/lib/utils';
import { 
  LayoutGrid, 
  FileText, 
  TrendingUp, 
  Users, 
  Loader2,
  ShoppingCart,
  MousePointer
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

export function CustomerBehaviorCard() {
  const { data: analytics, isLoading } = useOrderAnalytics();
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MousePointer className="h-5 w-5" />
            Comportamento do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (!analytics) return null;
  
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  
  // Preparar dados do gráfico
  const chartData = analytics.dailyTrend.map(d => ({
    date: formatDateLabel(d.date),
    'Catálogo': d.catalogItems,
    'Página do Produto': d.productPageItems,
  }));
  
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MousePointer className="h-5 w-5" />
          Comportamento de Compra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo Principal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="text-xs font-medium">Catálogo</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {analytics.catalogPercentage}%
            </div>
            <div className="text-xs text-muted-foreground">
              {analytics.catalogItems} itens
            </div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
              {formatPrice(analytics.catalogRevenue)}
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium">Página do Produto</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {analytics.productPagePercentage}%
            </div>
            <div className="text-xs text-muted-foreground">
              {analytics.productPageItems} itens
            </div>
            <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1">
              {formatPrice(analytics.productPageRevenue)}
            </div>
          </div>
          
          <div className="bg-secondary rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-medium">Total de Itens</span>
            </div>
            <div className="text-2xl font-bold">
              {analytics.totalItems}
            </div>
            <div className="text-xs text-muted-foreground">
              em {analytics.totalOrders} pedidos
            </div>
          </div>
          
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-success mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Receita Total</span>
            </div>
            <div className="text-2xl font-bold text-success">
              {formatPrice(analytics.totalRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">
              rastreada por origem
            </div>
          </div>
        </div>
        
        {/* Gráfico de Tendência */}
        {chartData.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-4">
              Tendência dos últimos 7 dias
            </h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Catálogo" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Página do Produto" 
                    stroke="#9333ea" 
                    strokeWidth={2}
                    dot={{ fill: '#9333ea', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Rankings de Clientes */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Top clientes do catálogo */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-blue-500" />
              Clientes que preferem o Catálogo
            </h4>
            {analytics.topCatalogCustomers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-2">
                {analytics.topCatalogCustomers.map((customer, idx) => (
                  <CustomerRow 
                    key={customer.customerId || customer.customerWhatsapp || idx} 
                    customer={customer}
                    rank={idx + 1}
                    highlight="catalog"
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Top clientes da página de produto */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              Clientes que abrem o Produto
            </h4>
            {analytics.topProductPageCustomers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="space-y-2">
                {analytics.topProductPageCustomers.map((customer, idx) => (
                  <CustomerRow 
                    key={customer.customerId || customer.customerWhatsapp || idx} 
                    customer={customer}
                    rank={idx + 1}
                    highlight="product_page"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Info sobre dados não rastreados */}
        {analytics.unknownItems > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <strong>Nota:</strong> {analytics.unknownItems} itens ({formatPrice(analytics.unknownRevenue)}) 
            foram adicionados antes do rastreamento de origem ser implementado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerRow({ 
  customer, 
  rank, 
  highlight 
}: { 
  customer: CustomerBehavior; 
  rank: number;
  highlight: 'catalog' | 'product_page';
}) {
  const name = customer.customerName || 'Cliente sem nome';
  const items = highlight === 'catalog' ? customer.catalogItems : customer.productPageItems;
  const revenue = highlight === 'catalog' ? customer.catalogRevenue : customer.productPageRevenue;
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {items} itens • {formatPrice(revenue)}
        </p>
      </div>
      <Badge 
        variant="secondary" 
        className={
          customer.preferredSource === 'catalog' 
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            : customer.preferredSource === 'product_page'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            : ''
        }
      >
        {customer.preferredSource === 'catalog' && 'Catálogo'}
        {customer.preferredSource === 'product_page' && 'Produto'}
        {customer.preferredSource === 'mixed' && 'Misto'}
      </Badge>
    </div>
  );
}
