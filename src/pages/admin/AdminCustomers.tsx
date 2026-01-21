import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useCustomers } from '@/hooks/useCustomers';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';
import { Search, Users, Phone, ShoppingBag, TrendingUp } from 'lucide-react';

export default function AdminCustomers() {
  const { data: customers, isLoading } = useCustomers();
  const { canViewPrices } = usePermissions();
  const [search, setSearch] = useState('');

  const filteredCustomers = customers?.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(searchLower) ||
      c.whatsapp.includes(search.replace(/\D/g, ''))
    );
  }) || [];

  // Estatísticas
  const totalCustomers = customers?.length || 0;
  const totalOrders = customers?.reduce((sum, c) => sum + c.order_count, 0) || 0;
  const totalRevenue = customers?.reduce((sum, c) => sum + c.total_spent, 0) || 0;
  const avgOrdersPerCustomer = totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : '0';

  const formatWhatsAppDisplay = (whatsapp: string) => {
    // Se começa com +, mantém o formato internacional
    if (whatsapp.startsWith('+')) {
      return whatsapp;
    }
    // Senão, tenta formatar como brasileiro
    if (whatsapp.length === 13 && whatsapp.startsWith('55')) {
      return `+${whatsapp.slice(0, 2)} (${whatsapp.slice(2, 4)}) ${whatsapp.slice(4, 9)}-${whatsapp.slice(9)}`;
    }
    if (whatsapp.length === 11) {
      return `(${whatsapp.slice(0, 2)}) ${whatsapp.slice(2, 7)}-${whatsapp.slice(7)}`;
    }
    return whatsapp;
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

        {/* Busca */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lista de Clientes */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
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
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {customer.name || 'Sem nome'}
                        </h3>
                        {customer.order_count >= 5 && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
