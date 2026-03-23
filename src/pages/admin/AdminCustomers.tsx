import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatPrice } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { 
  Search, Users, Phone, ShoppingBag, TrendingUp, 
  ChevronDown, ChevronUp, ArrowUpDown, ArrowDown, ArrowUp,
  CalendarIcon, Filter, X
} from 'lucide-react';

type SortField = 'name' | 'order_count' | 'total_spent' | 'created_at';
type SortDir = 'asc' | 'desc';

const STATUS_COLORS: Record<string, string> = {
  'NOVO': 'bg-primary/10 text-primary',
  'FECHADO': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'FINALIZADO': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'CANCELADO': 'bg-destructive/10 text-destructive',
};

export default function AdminCustomers() {
  const { data: customers, isLoading } = useCustomers();
  const { canViewPrices } = usePermissions();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = customers?.filter(c => {
      const searchLower = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(searchLower) ||
        c.whatsapp.includes(search.replace(/\D/g, ''))
      );
    }) || [];

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'order_count':
          cmp = a.order_count - b.order_count;
          break;
        case 'total_spent':
          cmp = a.total_spent - b.total_spent;
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [customers, search, sortField, sortDir]);

  // Estatísticas
  const totalCustomers = customers?.length || 0;
  const totalOrders = customers?.reduce((sum, c) => sum + c.order_count, 0) || 0;
  const totalRevenue = customers?.reduce((sum, c) => sum + c.total_spent, 0) || 0;
  const avgOrdersPerCustomer = totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : '0';

  const formatWhatsAppDisplay = (whatsapp: string) => {
    if (whatsapp.startsWith('+')) return whatsapp;
    if (whatsapp.length === 13 && whatsapp.startsWith('55')) {
      return `+${whatsapp.slice(0, 2)} (${whatsapp.slice(2, 4)}) ${whatsapp.slice(4, 9)}-${whatsapp.slice(9)}`;
    }
    if (whatsapp.length === 11) {
      return `(${whatsapp.slice(0, 2)}) ${whatsapp.slice(2, 7)}-${whatsapp.slice(7)}`;
    }
    return whatsapp;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5" /> 
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <AdminGuard>
      <AdminLayout title="Clientes">
        {/* Estatísticas */}
        <div className={`grid gap-4 mb-6 ${canViewPrices ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Clientes</p>
                  <p className="text-2xl font-bold">{totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {canViewPrices && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Receita Total</p>
                    <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Média Pedidos/Cliente</p>
                  <p className="text-2xl font-bold">{avgOrdersPerCustomer}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca + Ordenação */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortField === 'order_count' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('order_count')}
              className="gap-1.5"
            >
              <SortIcon field="order_count" />
              Pedidos
            </Button>
            {canViewPrices && (
              <Button
                variant={sortField === 'total_spent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSort('total_spent')}
                className="gap-1.5"
              >
                <SortIcon field="total_spent" />
                Valor
              </Button>
            )}
            <Button
              variant={sortField === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('name')}
              className="gap-1.5"
            >
              <SortIcon field="name" />
              Nome
            </Button>
          </div>
        </div>

        {/* Lista de Clientes */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAndSorted.map((customer) => {
              const isExpanded = expandedId === customer.id;
              return (
                <Collapsible key={customer.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : customer.id)}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {customer.name || 'Sem nome'}
                            </h3>
                            {customer.order_count >= 5 && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                VIP
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <a 
                              href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline"
                            >
                              {formatWhatsAppDisplay(customer.whatsapp)}
                            </a>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            Cliente desde {new Date(customer.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="text-right space-y-1">
                            <div className="flex items-center justify-end gap-1">
                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{customer.order_count}</span>
                              <span className="text-sm text-muted-foreground">
                                {customer.order_count === 1 ? 'pedido' : 'pedidos'}
                              </span>
                            </div>
                            
                            {canViewPrices && (
                              <p className="text-sm font-semibold text-green-600">
                                {formatPrice(customer.total_spent)}
                              </p>
                            )}
                          </div>

                          {customer.order_count > 0 && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>
                      </div>
                    </CardContent>

                    <CollapsibleContent>
                      <div className="border-t px-4 py-3 bg-secondary/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pedidos</p>
                        <div className="space-y-2">
                          {customer.orders.map(order => (
                            <div key={order.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-background">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-primary">
                                  #{order.order_number}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: '2-digit'
                                  })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {order.item_count} {order.item_count === 1 ? 'item' : 'itens'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {canViewPrices && (
                                  <span className="text-sm font-medium">
                                    {formatPrice(order.total_cents)}
                                  </span>
                                )}
                                <Badge 
                                  variant="secondary" 
                                  className={`text-[10px] ${STATUS_COLORS[order.status] || 'bg-secondary text-muted-foreground'}`}
                                >
                                  {order.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
