import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { useOrderIntents, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Loader2, Eye, MapPin, Truck, FileText, Phone, User } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OrderIntent } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';

const STATUS_OPTIONS = [
  { value: 'NOVO', label: 'Novo', color: 'bg-primary/10 text-primary' },
  { value: 'CONTATADO', label: 'Contatado', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'FECHADO', label: 'Fechado', color: 'bg-success/10 text-success' },
  { value: 'PERDIDO', label: 'Perdido', color: 'bg-destructive/10 text-destructive' },
];

const AdminOrders = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderIntent | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const { data: orders = [], isLoading } = useOrderIntents();
  const { data: storeSettings } = useStoreSettings();
  const { data: products = [] } = useProducts();
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { toast } = useToast();

  const generatePdf = async (order: OrderIntent) => {
    setIsGeneratingPdf(true);
    try {
      const logoUrl = storeSettings?.store_logo_url || `${window.location.origin}/logo.png`;
      
      const items = order.order_intent_items?.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          productName: item.product_name,
          size: item.size,
          color: null,
          quantity: item.qty,
          unitPriceCents: item.unit_price_cents,
          imageUrl: product?.main_image_url || undefined,
        };
      }) || [];

      const { data, error } = await supabase.functions.invoke('generate-order-pdf', {
        body: {
          orderNumber: order.order_number,
          customerName: order.customer_name || 'Cliente',
          customerWhatsapp: order.customer_whatsapp || '',
          items,
          subtotalCents: order.subtotal_cents,
          shippingService: order.shipping_service || '',
          shippingPriceCents: order.shipping_price_cents || 0,
          shippingDeadlineDays: order.shipping_deadline_days || 0,
          totalCents: order.total_cents,
          destCep: order.dest_cep || '',
          skipShipping: !order.shipping_service,
          orderDate: new Date(order.created_at).toLocaleDateString('pt-BR'),
          logoUrl,
          siteUrl: window.location.origin,
        },
      });

      if (error) throw error;

      // Open PDF in new tab
      const pdfUrl = data?.pdfUrl as string | undefined;
      if (!pdfUrl) throw new Error('Resposta inválida ao gerar PDF');
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

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
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Total</TableHead>
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
                        {order.order_intent_items?.length || 0} item(ns)
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
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                      <p className="font-semibold text-lg">
                        {formatPrice(order.total_cents)}
                      </p>
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
                      onClick={() => generatePdf(selectedOrder)}
                      disabled={isGeneratingPdf}
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          PDF
                        </>
                      )}
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
