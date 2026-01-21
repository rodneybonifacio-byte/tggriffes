import { useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useOrderIntents, useUpdateOrderStatus, useAddOrderHistory } from '@/hooks/useOrders';
import { useAllCartReservations, useCleanupExpiredReservations, CartReservation } from '@/hooks/useCartReservations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShoppingCart, Trash2, Clock, Package, AlertTriangle, RefreshCw, Timer, ShoppingBag } from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getColorDisplayName } from '@/lib/utils';

export default function AdminAbandonedCarts() {
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrderIntents();
  const { data: reservations, isLoading: reservationsLoading, refetch: refetchReservations } = useAllCartReservations();
  const updateStatus = useUpdateOrderStatus();
  const addHistory = useAddOrderHistory();
  const cleanupExpired = useCleanupExpiredReservations();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedReservationIds, setSelectedReservationIds] = useState<string[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeletingReservations, setIsDeletingReservations] = useState(false);

  // Filter orders with status NOVO (these are potential abandoned carts)
  const abandonedCarts = orders?.filter(order => order.status === 'NOVO') || [];
  
  // Group reservations by session
  const now = new Date();
  const activeReservations = reservations?.filter(r => new Date(r.expires_at) > now) || [];
  const expiredReservations = reservations?.filter(r => new Date(r.expires_at) <= now) || [];
  
  // Group active reservations by session_id
  const reservationsBySession = activeReservations.reduce((acc, res) => {
    if (!acc[res.session_id]) {
      acc[res.session_id] = [];
    }
    acc[res.session_id].push(res);
    return acc;
  }, {} as Record<string, CartReservation[]>);
  
  // Categorize orders by age
  const veryOld = abandonedCarts.filter(o => differenceInHours(now, new Date(o.created_at)) > 72);
  const old = abandonedCarts.filter(o => {
    const hours = differenceInHours(now, new Date(o.created_at));
    return hours > 24 && hours <= 72;
  });

  // Calculate total items held
  const totalItemsHeldOrders = abandonedCarts.reduce((sum, order) => {
    return sum + (order.order_intent_items?.reduce((itemSum, item) => itemSum + item.qty, 0) || 0);
  }, 0);
  
  const totalItemsHeldReservations = activeReservations.reduce((sum, r) => sum + r.quantity, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === abandonedCarts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(abandonedCarts.map(o => o.id));
    }
  };

  const selectByAge = (ageFilter: 'very_old' | 'old' | 'all') => {
    let toSelect: string[] = [];
    if (ageFilter === 'very_old') {
      toSelect = veryOld.map(o => o.id);
    } else if (ageFilter === 'old') {
      toSelect = [...veryOld, ...old].map(o => o.id);
    } else {
      toSelect = abandonedCarts.map(o => o.id);
    }
    setSelectedIds(toSelect);
  };

  const handleCancelSelected = async () => {
    if (selectedIds.length === 0) return;
    
    setIsCancelling(true);
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of selectedIds) {
      try {
        await updateStatus.mutateAsync({ id: orderId, status: 'CANCELADO' });
        await addHistory.mutateAsync({
          order_intent_id: orderId,
          action: 'status_change',
          description: 'Carrinho abandonado cancelado pelo gestor (liberação de estoque)',
          changes: { from: 'NOVO', to: 'CANCELADO', reason: 'abandoned_cart_cleanup' }
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error cancelling order:', orderId, error);
      }
    }

    setIsCancelling(false);
    setSelectedIds([]);
    refetchOrders();

    if (successCount > 0) {
      toast.success(`${successCount} carrinho(s) cancelado(s) - estoque liberado!`);
    }
    if (errorCount > 0) {
      toast.error(`Erro ao cancelar ${errorCount} carrinho(s)`);
    }
  };

  const handleDeleteSelectedReservations = async () => {
    if (selectedReservationIds.length === 0) return;
    
    setIsDeletingReservations(true);
    
    try {
      const { error } = await supabase
        .from('cart_reservations')
        .delete()
        .in('id', selectedReservationIds);
      
      if (error) throw error;
      
      toast.success(`${selectedReservationIds.length} reserva(s) removida(s) - estoque liberado!`);
      setSelectedReservationIds([]);
      refetchReservations();
    } catch (error) {
      console.error('Error deleting reservations:', error);
      toast.error('Erro ao remover reservas');
    } finally {
      setIsDeletingReservations(false);
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const result = await cleanupExpired.mutateAsync();
      toast.success(`${result.cleaned} reserva(s) expirada(s) removida(s)`);
    } catch (error) {
      console.error('Error cleaning up:', error);
      toast.error('Erro ao limpar reservas expiradas');
    }
  };

  const getAgeColor = (createdAt: string) => {
    const hours = differenceInHours(now, new Date(createdAt));
    if (hours > 72) return 'text-red-600 bg-red-50';
    if (hours > 24) return 'text-amber-600 bg-amber-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getAgeBadge = (createdAt: string) => {
    const hours = differenceInHours(now, new Date(createdAt));
    if (hours > 72) return <Badge variant="destructive">+72h</Badge>;
    if (hours > 24) return <Badge className="bg-amber-500">+24h</Badge>;
    return <Badge variant="secondary">Recente</Badge>;
  };

  const getExpirationBadge = (expiresAt: string) => {
    const minutesLeft = differenceInMinutes(new Date(expiresAt), now);
    if (minutesLeft <= 0) return <Badge variant="destructive">Expirado</Badge>;
    if (minutesLeft <= 10) return <Badge className="bg-amber-500">{minutesLeft}min</Badge>;
    return <Badge variant="secondary">{minutesLeft}min</Badge>;
  };

  const isLoading = ordersLoading || reservationsLoading;

  return (
    <AdminGuard>
      <AdminLayout title="Carrinhos Abandonados">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Reservas Ativas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{Object.keys(reservationsBySession).length}</div>
                <p className="text-xs text-muted-foreground">{activeReservations.length} itens reservados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Pedidos NOVO
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{abandonedCarts.length}</div>
                <p className="text-xs text-muted-foreground">aguardando finalização</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Estoque Retido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{totalItemsHeldReservations + totalItemsHeldOrders}</div>
                <p className="text-xs text-muted-foreground">{totalItemsHeldReservations} em reservas + {totalItemsHeldOrders} em pedidos</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Críticos (+72h)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{veryOld.length}</div>
                <p className="text-xs text-red-600/70">prioridade para cancelar</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-amber-600">
                  <Clock className="h-4 w-4" />
                  Expirados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{expiredReservations.length}</div>
                <p className="text-xs text-amber-600/70">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto text-amber-600"
                    onClick={handleCleanupExpired}
                    disabled={cleanupExpired.isPending}
                  >
                    {cleanupExpired.isPending ? 'Limpando...' : 'Limpar agora'}
                  </Button>
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="reservations" className="w-full">
            <TabsList>
              <TabsTrigger value="reservations" className="gap-2">
                <Timer className="h-4 w-4" />
                Reservas em Carrinho ({activeReservations.length})
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pedidos NOVO ({abandonedCarts.length})
              </TabsTrigger>
            </TabsList>

            {/* Reservations Tab */}
            <TabsContent value="reservations">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">Reservas de Carrinho</CardTitle>
                      <CardDescription>
                        Itens reservados por clientes navegando na loja (expiram em 30 min)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => refetchReservations()}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Atualizar
                      </Button>
                      {selectedReservationIds.length > 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover {selectedReservationIds.length}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Reservas?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Você está prestes a remover <strong>{selectedReservationIds.length}</strong> reserva(s).
                                <br /><br />
                                <strong className="text-green-600">O estoque será automaticamente restaurado.</strong>
                                <br /><br />
                                Isso pode impactar a experiência do cliente que está navegando.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleDeleteSelectedReservations}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isDeletingReservations ? 'Removendo...' : 'Confirmar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reservationsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : activeReservations.length === 0 ? (
                    <div className="text-center py-8">
                      <Timer className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-muted-foreground">Nenhuma reserva ativa!</p>
                      <p className="text-sm text-green-600">Nenhum cliente está com itens no carrinho no momento.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox 
                                checked={selectedReservationIds.length === activeReservations.length && activeReservations.length > 0}
                                onCheckedChange={() => {
                                  if (selectedReservationIds.length === activeReservations.length) {
                                    setSelectedReservationIds([]);
                                  } else {
                                    setSelectedReservationIds(activeReservations.map(r => r.id));
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Variante</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Sessão</TableHead>
                            <TableHead>Expira em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeReservations
                            .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
                            .map(reservation => (
                              <TableRow
                                key={reservation.id}
                                className={selectedReservationIds.includes(reservation.id) ? 'bg-muted/50' : ''}
                              >
                                <TableCell>
                                  <Checkbox 
                                    checked={selectedReservationIds.includes(reservation.id)}
                                    onCheckedChange={() => {
                                      setSelectedReservationIds(prev => 
                                        prev.includes(reservation.id) 
                                          ? prev.filter(i => i !== reservation.id) 
                                          : [...prev, reservation.id]
                                      );
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {reservation.image_url && (
                                      <img 
                                        src={reservation.image_url} 
                                        alt="" 
                                        className="w-8 h-8 object-cover rounded"
                                      />
                                    )}
                                    <span className="font-medium max-w-[150px] truncate">
                                      {reservation.product_name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    {reservation.size}
                                    {reservation.color && ` / ${getColorDisplayName(reservation.color)}`}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">{reservation.quantity}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {reservation.session_id.slice(0, 8)}...
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {getExpirationBadge(reservation.expires_at)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">Pedidos com Status NOVO</CardTitle>
                      <CardDescription>
                        Pedidos criados mas não finalizados - consomem estoque até cancelamento
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => refetchOrders()}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">Selecionar:</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => selectByAge('very_old')}
                      disabled={veryOld.length === 0}
                    >
                      Críticos ({veryOld.length})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => selectByAge('old')}
                      disabled={[...veryOld, ...old].length === 0}
                    >
                      +24h ({[...veryOld, ...old].length})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      {selectedIds.length === abandonedCarts.length ? 'Desmarcar Todos' : 'Todos'}
                    </Button>

                    {selectedIds.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="ml-auto"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancelar {selectedIds.length} selecionado(s)
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar Carrinhos Abandonados?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Você está prestes a cancelar <strong>{selectedIds.length}</strong> carrinho(s).
                              <br /><br />
                              <strong className="text-green-600">O estoque será automaticamente restaurado</strong> para as variantes desses pedidos.
                              <br /><br />
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleCancelSelected}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {/* Table */}
                  {ordersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : abandonedCarts.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-muted-foreground">Nenhum pedido abandonado!</p>
                      <p className="text-sm text-green-600">Todo o estoque está disponível para venda.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox 
                                checked={selectedIds.length === abandonedCarts.length && abandonedCarts.length > 0}
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Criado</TableHead>
                            <TableHead>Idade</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {abandonedCarts
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map(order => {
                              const itemCount = order.order_intent_items?.reduce((sum, item) => sum + item.qty, 0) || 0;
                              return (
                                <TableRow
                                  key={order.id}
                                  className={selectedIds.includes(order.id) ? 'bg-muted/50' : ''}
                                >
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedIds.includes(order.id)}
                                      onCheckedChange={() => toggleSelect(order.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Link 
                                      to={`/admin/pedidos?order=${order.order_number}`}
                                      className="font-medium hover:underline"
                                    >
                                      #{order.order_number}
                                    </Link>
                                  </TableCell>
                                  <TableCell>
                                    <div className="max-w-[150px] truncate">
                                      {order.customer_name || 'Sem nome'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {order.customer_whatsapp}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-medium">{itemCount}</span>
                                    <span className="text-muted-foreground text-xs ml-1">peças</span>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>
                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getAgeColor(order.created_at)}`}>
                                      <Clock className="h-3 w-3" />
                                      {formatDistanceToNow(new Date(order.created_at), { 
                                        locale: ptBR, 
                                        addSuffix: false 
                                      })}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {getAgeBadge(order.created_at)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Info Card */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="shrink-0">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Como funciona?</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li><strong>Reservas de Carrinho:</strong> Quando um cliente adiciona itens ao carrinho, o estoque é reservado por 30 minutos</li>
                    <li><strong>Pedidos NOVO:</strong> Quando o cliente finaliza o checkout, o pedido é criado com status NOVO e consome estoque</li>
                    <li>Reservas expiradas são limpas automaticamente ou manualmente</li>
                    <li>Ao cancelar pedidos, o estoque é <strong>automaticamente restaurado</strong></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
