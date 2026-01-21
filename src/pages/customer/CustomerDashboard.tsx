import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { formatPrice, getColorDisplayName } from '@/lib/utils';
import { 
  ShoppingBag, Package, User, LogOut, ArrowLeft, Loader2, 
  Clock, CheckCircle, Truck, XCircle, Edit2, Save 
} from 'lucide-react';

interface CustomerOrder {
  id: string;
  order_number: number;
  status: string;
  total_cents: number;
  shipping_service: string | null;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    size: string;
    color: string | null;
    qty: number;
    unit_price_cents: number;
  }[];
}

interface CustomerData {
  id: string;
  name: string | null;
  whatsapp: string;
  email: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'NOVO': { label: 'Novo', color: 'bg-blue-100 text-blue-800', icon: Clock },
  'EM_ATENDIMENTO': { label: 'Em Atendimento', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  'ENVIADO': { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  'FINALIZADO': { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'CANCELADO': { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function CustomerDashboard() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { data: settings } = useStoreSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  // Fetch customer data
  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerData | null;
    },
    enabled: !!user?.email,
  });

  // Fetch customer orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', customerData?.id],
    queryFn: async () => {
      if (!customerData?.id) return [];

      const { data: orderIntents, error: ordersError } = await supabase
        .from('order_intents')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch items for each order
      const ordersWithItems = await Promise.all(
        (orderIntents || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_intent_items')
            .select('id, product_name, size, color, qty, unit_price_cents')
            .eq('order_intent_id', order.id);

          return {
            ...order,
            items: items || [],
          };
        })
      );

      return ordersWithItems as CustomerOrder[];
    },
    enabled: !!customerData?.id,
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async ({ name, whatsapp }: { name: string; whatsapp: string }) => {
      if (!customerData?.id) throw new Error('Cliente não encontrado');

      const { error } = await supabase
        .from('customers')
        .update({ name, whatsapp: whatsapp.replace(/\D/g, '') })
        .eq('id', customerData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      setIsEditing(false);
      toast({ title: 'Dados atualizados!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    },
  });

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/entrar" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const startEditing = () => {
    setEditName(customerData?.name || '');
    setEditWhatsapp(customerData?.whatsapp || '');
    setIsEditing(true);
  };

  const saveEditing = () => {
    updateCustomer.mutate({ name: editName, whatsapp: editWhatsapp });
  };

  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Voltar à loja</span>
          </Link>
          
          {settings?.store_logo_url ? (
            <img src={settings.store_logo_url} alt={settings.store_name} className="h-8 object-contain" />
          ) : (
            <span className="font-bold">{settings?.store_name || 'Loja'}</span>
          )}
          
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Minha Conta</h1>

        {authLoading || customerLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !customerData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Não encontramos seus dados cadastrais.
              </p>
              <p className="text-sm text-muted-foreground">
                Faça um pedido na loja para vincular sua conta.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="orders" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="orders" className="gap-2">
                <Package className="h-4 w-4" />
                Meus Pedidos
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                Meus Dados
              </TabsTrigger>
            </TabsList>

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                        <p className="text-2xl font-bold">{totalOrders}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Package className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total em Compras</p>
                        <p className="text-2xl font-bold">{formatPrice(totalSpent)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders List */}
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : orders?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Você ainda não fez nenhum pedido.
                    </p>
                    <Button asChild>
                      <Link to="/">Ver produtos</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders?.map((order) => {
                    const status = statusConfig[order.status] || statusConfig['NOVO'];
                    const StatusIcon = status.icon;
                    
                    return (
                      <Card key={order.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Pedido #{order.order_number}
                            </CardTitle>
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {item.qty}x {item.product_name} - {item.size}
                                  {item.color && ` (${getColorDisplayName(item.color)})`}
                                </span>
                                <span>{formatPrice(item.unit_price_cents * item.qty)}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="border-t mt-4 pt-4 flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              {order.shipping_service || 'Frete a combinar'}
                            </span>
                            <span className="font-semibold">
                              Total: {formatPrice(order.total_cents)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Dados Cadastrais</CardTitle>
                    {!isEditing && (
                      <Button variant="outline" size="sm" onClick={startEditing}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="editName">Nome</Label>
                        <Input
                          id="editName"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="editWhatsapp">WhatsApp</Label>
                        <Input
                          id="editWhatsapp"
                          value={editWhatsapp}
                          onChange={(e) => setEditWhatsapp(e.target.value.replace(/[^\d+]/g, ''))}
                          maxLength={20}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ''} disabled />
                        <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button onClick={saveEditing} disabled={updateCustomer.isPending}>
                          {updateCustomer.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-muted-foreground">Nome</Label>
                        <p className="font-medium">{customerData.name || 'Não informado'}</p>
                      </div>
                      
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{customerData.email || user?.email}</p>
                      </div>
                      
                      <div>
                        <Label className="text-muted-foreground">WhatsApp</Label>
                        <p className="font-medium">{customerData.whatsapp}</p>
                      </div>
                      
                      <div>
                        <Label className="text-muted-foreground">Cliente desde</Label>
                        <p className="font-medium">
                          {new Date(customerData.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
