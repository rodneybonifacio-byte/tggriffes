import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { OrderEditModal } from '@/components/admin/OrderEditModal';
import { useOrderIntentsLight, useOrderIntentItems, useUpdateOrderStatus, useAddOrderHistory, useOrderHistory } from '@/hooks/useOrders';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ShoppingCart, Loader2, Eye, MapPin, Truck, FileText, Phone, User, MessageSquare, Pencil, History, Clock, AlertTriangle, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OrderIntentWithCount } from '@/hooks/useOrders';

const STATUS_OPTIONS = [
  { value: 'NOVO', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { value: 'CONFIRMADO', label: 'Confirmado', color: 'bg-orange-100 text-orange-700' },
  { value: 'EM_SEPARACAO', label: 'Em separação', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  { value: 'FINALIZADO', label: 'Finalizado', color: 'bg-green-100 text-green-700' },
];

const getStatusColor = (status: string) => {
  return STATUS_OPTIONS.find(opt => opt.value === status)?.color || '';
};

const AdminOrders = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<OrderIntentWithCount | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderIntentWithCount | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<{ id: string; currentStatus: string } | null>(null);

  const { data: orders = [], isLoading } = useOrderIntentsLight();
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { mutateAsync: addHistory } = useAddOrderHistory();
  const { data: orderHistory = [] } = useOrderHistory(selectedOrder?.id || null);
  const { data: selectedOrderItems = [] } = useOrderIntentItems(selectedOrder?.id || null);
  const { toast } = useToast();
  const { canViewPrices } = usePermissions();

  const openPdfViewer = (order: OrderIntentWithCount) => {
    if (!order.order_number) {
      toast({ title: 'Pedido sem número', variant: 'destructive' });
      return;
    }

    // Importante: abre o visualizador diretamente (gera sob demanda, sem salvar arquivo)
    // e evita bloqueio de popup por chamadas assíncronas.
    window.open(`/pedidos/pdf/${order.order_number}`, '_blank', 'noopener,noreferrer');
  };

  const filteredOrders = orders.filter(order => {
    // Filter by status
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    
    // Filter by search query (name or phone)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = order.customer_name?.toLowerCase().includes(query);
      const phoneMatch = order.customer_whatsapp?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      if (!nameMatch && !phoneMatch) return false;
    }
    
    return true;
  });

  const handleStatusChange = async (orderId: string, newStatus: string, currentStatus?: string) => {
    // Show confirmation dialog for cancellation
    if (newStatus === 'CANCELADO') {
      setCancelConfirmOrder({ id: orderId, currentStatus: currentStatus || 'NOVO' });
      return;
    }
    
    await executeStatusChange(orderId, newStatus, currentStatus);
  };

  const executeStatusChange = async (orderId: string, newStatus: string, currentStatus?: string) => {
    try {
      await updateStatus({ id: orderId, status: newStatus });
      
      // Log status change in history
      const oldLabel = STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus;
      const newLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus;
      await addHistory({
        order_intent_id: orderId,
        action: 'status_changed',
        description: `Status alterado: ${oldLabel} → ${newLabel}`,
        changes: { old_status: currentStatus, new_status: newStatus },
      });
      
      toast({ title: 'Status atualizado!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmOrder) return;
    await executeStatusChange(cancelConfirmOrder.id, 'CANCELADO', cancelConfirmOrder.currentStatus);
    setCancelConfirmOrder(null);
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge variant="secondary" className={option?.color || ''}>
        {option?.label || status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminGuard>
      <AdminLayout title="Pedidos">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem 
                  key={opt.value} 
                  value={opt.value}
                  className={`${opt.color} rounded-sm my-0.5`}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search by name or phone */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="text-right text-sm text-muted-foreground self-center whitespace-nowrap">
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum pedido encontrado</p>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' ? 'Tente alterar os filtros' : 'Os pedidos aparecerão aqui quando clientes finalizarem pelo WhatsApp'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    {canViewPrices && <TableHead className="text-right">Total</TableHead>}
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold text-primary">
                        #{order.order_number}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {order.customer_name || 'Não informado'}
                          </span>
                          {order.customer_whatsapp && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customer_whatsapp}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.order_intent_items?.[0]?.count ?? 0} item(ns)
                      </TableCell>
                      {canViewPrices && (
                        <TableCell className="text-right font-medium">
                          {formatPrice(order.total_cents)}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Select 
                            value={order.status} 
                            onValueChange={(value) => handleStatusChange(order.id, value, order.status)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className={`w-32 h-8 ${getStatusColor(order.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem 
                                  key={opt.value} 
                                  value={opt.value}
                                  className={`${opt.color} rounded-sm my-0.5`}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {order.status === 'CANCELADO' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                              ↩ Estoque restaurado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-primary mb-1">
                          #{order.order_number}
                        </p>
                        <p className="font-medium flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {order.customer_name || 'Não informado'}
                        </p>
                        {order.customer_whatsapp && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customer_whatsapp}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(order.status)}
                        {order.status === 'CANCELADO' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                            ↩ Estoque restaurado
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                      {canViewPrices && (
                        <p className="font-semibold text-lg">
                          {formatPrice(order.total_cents)}
                        </p>
                      )}
                    </div>

                     <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                       <span>{order.order_intent_items?.[0]?.count ?? 0} item(ns)</span>
                      {order.shipping_service && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {order.shipping_service}
                        </span>
                      )}
                      {order.dest_cep && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {order.dest_cep}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Select 
                        value={order.status} 
                        onValueChange={(value) => handleStatusChange(order.id, value, order.status)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className={`flex-1 ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem 
                              key={opt.value} 
                              value={opt.value}
                              className={`${opt.color} rounded-sm my-0.5`}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Order Details Modal */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pedido #{selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(selectedOrder.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedOrder.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingOrder(selectedOrder);
                        setSelectedOrder(null);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPdfViewer(selectedOrder)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>

                {/* Items */}
                <div className="border rounded-lg divide-y">
                  {selectedOrder.order_intent_items?.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Tam: {item.size} | Qtd: {item.qty}
                        </p>
                      </div>
                      {canViewPrices && (
                        <span className="font-medium">
                          {formatPrice(item.line_total_cents)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Shipping */}
                {selectedOrder.shipping_service && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOrder.shipping_service}</span>
                    {selectedOrder.shipping_deadline_days && (
                      <span className="text-muted-foreground">
                        ({selectedOrder.shipping_deadline_days} dias)
                      </span>
                    )}
                  </div>
                )}

                {selectedOrder.dest_cep && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>CEP: {selectedOrder.dest_cep}</span>
                  </div>
                )}

                {/* Observations */}
                {selectedOrder.observations && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">Observações</span>
                    </div>
                    <p className="text-sm">{selectedOrder.observations}</p>
                  </div>
                )}

                {/* Totals - Only visible for admins */}
                {canViewPrices && (
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatPrice(selectedOrder.subtotal_cents)}</span>
                    </div>
                    {selectedOrder.shipping_price_cents && (
                      <div className="flex justify-between text-sm">
                        <span>Frete</span>
                        <span>{formatPrice(selectedOrder.shipping_price_cents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total</span>
                      <span>{formatPrice(selectedOrder.total_cents)}</span>
                    </div>
                  </div>
                )}

                {/* Status Update */}
                <div className="pt-2">
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(value) => {
                      handleStatusChange(selectedOrder.id, value, selectedOrder.status);
                      setSelectedOrder({ ...selectedOrder, status: value });
                    }}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Order History */}
                {orderHistory.length > 0 && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span>Histórico de Alterações</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {orderHistory.map((entry) => (
                        <div key={entry.id} className="text-xs bg-secondary/30 rounded p-2">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(entry.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-foreground">{entry.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Order Modal */}
        <OrderEditModal 
          order={editingOrder}
          open={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {
            // Refresh the data
          }}
        />

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!cancelConfirmOrder} onOpenChange={(open) => !open && setCancelConfirmOrder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Cancelar Pedido
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-2">
                <p>Tem certeza que deseja cancelar este pedido?</p>
                <p className="font-medium text-amber-600">
                  ⚠️ O estoque de todos os itens será restaurado automaticamente.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmCancel}
                className="bg-destructive hover:bg-destructive/90"
              >
                Sim, cancelar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminOrders;
