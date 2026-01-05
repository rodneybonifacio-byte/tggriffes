import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useOrderIntents, useUpdateOrderStatus } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Loader2, Eye, MapPin, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OrderIntent } from '@/hooks/useOrders';

const STATUS_OPTIONS = [
  { value: 'NOVO', label: 'Novo', color: 'bg-primary/10 text-primary' },
  { value: 'CONTATADO', label: 'Contatado', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'FECHADO', label: 'Fechado', color: 'bg-success/10 text-success' },
  { value: 'PERDIDO', label: 'Perdido', color: 'bg-destructive/10 text-destructive' },
];

const AdminOrders = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderIntent | null>(null);
  
  const { data: orders = [], isLoading } = useOrderIntents();
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { toast } = useToast();

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus({ id: orderId, status: newStatus });
      toast({ title: 'Status atualizado!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
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
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 text-right text-sm text-muted-foreground self-center">
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
                    <TableHead>Data</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Frete</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell>
                        {order.order_intent_items?.length || 0} item(ns)
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(order.subtotal_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.shipping_price_cents ? formatPrice(order.shipping_price_cents) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(order.total_cents)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Select 
                          value={order.status} 
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </p>
                        <p className="font-semibold text-lg">
                          {formatPrice(order.total_cents)}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span>{order.order_intent_items?.length || 0} item(ns)</span>
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
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Pedido</DialogTitle>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(selectedOrder.created_at)}
                  </span>
                  {getStatusBadge(selectedOrder.status)}
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
                      <span className="font-medium">
                        {formatPrice(item.line_total_cents)}
                      </span>
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

                {/* Totals */}
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

                {/* Status Update */}
                <div className="pt-2">
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(value) => {
                      handleStatusChange(selectedOrder.id, value);
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminOrders;
