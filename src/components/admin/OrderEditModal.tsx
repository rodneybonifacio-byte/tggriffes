import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  OrderIntent, 
  useUpdateOrderIntent, 
  useDeleteOrderItem, 
  useUpdateOrderItem, 
  useAddOrderItem,
  useAddOrderHistory
} from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { CurrencyInput } from './CurrencyInput';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

interface OrderEditModalProps {
  order: OrderIntent | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type OrderItem = Tables<'order_intent_items'>;

export function OrderEditModal({ order, open, onClose, onSaved }: OrderEditModalProps) {
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [observations, setObservations] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [destCep, setDestCep] = useState('');
  const [shippingService, setShippingService] = useState('');
  const [shippingPriceCents, setShippingPriceCents] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // New item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newQty, setNewQty] = useState(1);
  
  // Delete confirmation
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null);
  
  const { data: products = [] } = useProducts({ status: 'active' });
  const { mutateAsync: updateOrder } = useUpdateOrderIntent();
  const { mutateAsync: deleteItem } = useDeleteOrderItem();
  const { mutateAsync: updateItem } = useUpdateOrderItem();
  const { mutateAsync: addItem } = useAddOrderItem();
  const { mutateAsync: addHistory } = useAddOrderHistory();
  const { toast } = useToast();

  useEffect(() => {
    if (order) {
      setEditedItems(order.order_intent_items || []);
      setObservations(order.observations || '');
      setCustomerName(order.customer_name || '');
      setCustomerWhatsapp(order.customer_whatsapp || '');
      setDestCep(order.dest_cep || '');
      setShippingService(order.shipping_service || '');
      setShippingPriceCents(order.shipping_price_cents || 0);
    }
  }, [order]);

  useEffect(() => {
    setNewSize('');
  }, [newProductId]);

  const calculateSubtotal = () => {
    return editedItems.reduce((sum, item) => sum + item.line_total_cents, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + (shippingPriceCents || 0);
  };

  const handleItemQtyChange = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setEditedItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            qty: newQty,
            line_total_cents: newQty * item.unit_price_cents,
          };
        }
        return item;
      })
    );
  };

  const handleItemPriceChange = (itemId: string, newPriceCents: number) => {
    setEditedItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            unit_price_cents: newPriceCents,
            line_total_cents: item.qty * newPriceCents,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (item: OrderItem) => {
    setItemToDelete(item);
  };

  const confirmRemoveItem = () => {
    if (itemToDelete) {
      setEditedItems(items => items.filter(item => item.id !== itemToDelete.id));
      setItemToDelete(null);
    }
  };

  const handleAddNewItem = () => {
    if (!newProductId || !newSize || newQty < 1) {
      toast({ title: 'Preencha todos os campos do item', variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id === newProductId);
    if (!product) return;

    const newItem: OrderItem = {
      id: `new-${Date.now()}`,
      order_intent_id: order!.id,
      product_id: product.id,
      product_name: product.name,
      variant_id: null,
      size: newSize,
      qty: newQty,
      unit_price_cents: product.price_cents,
      line_total_cents: newQty * product.price_cents,
      created_at: new Date().toISOString(),
    };

    setEditedItems([...editedItems, newItem]);
    setShowAddItem(false);
    setNewProductId('');
    setNewSize('');
    setNewQty(1);
  };

  const handleSave = async () => {
    if (!order) return;
    
    setIsSaving(true);
    try {
      const originalItems = order.order_intent_items || [];
      const originalItemIds = originalItems.map(i => i.id);
      const currentItemIds = editedItems.map(i => i.id);
      const changes: string[] = [];

      // Delete removed items
      const itemsToDelete = originalItemIds.filter(id => !currentItemIds.includes(id));
      for (const itemId of itemsToDelete) {
        const removedItem = originalItems.find(i => i.id === itemId);
        if (removedItem) {
          changes.push(`Removido: ${removedItem.product_name} (${removedItem.size}) x${removedItem.qty}`);
        }
        await deleteItem(itemId);
      }

      // Update existing items
      for (const item of editedItems) {
        if (originalItemIds.includes(item.id)) {
          const original = originalItems.find(i => i.id === item.id);
          if (original && (
            original.qty !== item.qty || 
            original.unit_price_cents !== item.unit_price_cents
          )) {
            const itemChanges: string[] = [];
            if (original.qty !== item.qty) {
              itemChanges.push(`qtd: ${original.qty}→${item.qty}`);
            }
            if (original.unit_price_cents !== item.unit_price_cents) {
              itemChanges.push(`preço: ${formatPrice(original.unit_price_cents)}→${formatPrice(item.unit_price_cents)}`);
            }
            changes.push(`${item.product_name} (${item.size}): ${itemChanges.join(', ')}`);
            
            await updateItem({
              id: item.id,
              qty: item.qty,
              unit_price_cents: item.unit_price_cents,
              line_total_cents: item.line_total_cents,
            });
          }
        }
      }

      // Add new items
      const newItems = editedItems.filter(item => item.id.startsWith('new-'));
      for (const item of newItems) {
        changes.push(`Adicionado: ${item.product_name} (${item.size}) x${item.qty}`);
        await addItem({
          order_intent_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_id: item.variant_id,
          size: item.size,
          qty: item.qty,
          unit_price_cents: item.unit_price_cents,
          line_total_cents: item.line_total_cents,
        });
      }

      // Check for other changes
      if (customerName !== (order.customer_name || '')) {
        changes.push(`Nome: ${order.customer_name || '(vazio)'}→${customerName || '(vazio)'}`);
      }
      if (customerWhatsapp !== (order.customer_whatsapp || '')) {
        changes.push(`WhatsApp alterado`);
      }
      if (observations !== (order.observations || '')) {
        changes.push(`Observações atualizadas`);
      }
      if (shippingPriceCents !== (order.shipping_price_cents || 0)) {
        changes.push(`Frete: ${formatPrice(order.shipping_price_cents || 0)}→${formatPrice(shippingPriceCents)}`);
      }

      // Update order totals and observations
      const subtotal = calculateSubtotal();
      const total = calculateTotal();
      
      await updateOrder({
        id: order.id,
        observations,
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        dest_cep: destCep,
        shipping_service: shippingService || null,
        shipping_price_cents: shippingPriceCents || null,
        subtotal_cents: subtotal,
        total_cents: total,
      });

      // Log history if there were changes
      if (changes.length > 0) {
        await addHistory({
          order_intent_id: order.id,
          action: 'updated',
          description: changes.join(' | '),
          changes: {
            items_removed: itemsToDelete.length,
            items_added: newItems.length,
            items_updated: editedItems.filter(item => {
              const original = originalItems.find(i => i.id === item.id);
              return original && (original.qty !== item.qty || original.unit_price_cents !== item.unit_price_cents);
            }).length,
            new_total: total,
            old_total: order.total_cents,
          },
        });
      }

      toast({ title: 'Pedido atualizado com sucesso!' });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      toast({ title: 'Erro ao salvar pedido', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProduct = products.find(p => p.id === newProductId);
  const availableSizes = (() => {
    const sizes = Array.from(
      new Set((selectedProduct?.product_variants || []).map(v => v.size))
    );

    const commonOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];

    return sizes.sort((a, b) => {
      const ai = commonOrder.indexOf(a);
      const bi = commonOrder.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b, 'pt-BR', { numeric: true });
    });
  })();

  if (!order) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome do Cliente</Label>
              <Input 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input 
                value={customerWhatsapp} 
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Itens do Pedido</Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            </div>

            <div className="border rounded-lg divide-y">
              {editedItems.map((item) => {
                const itemProduct = products.find(p => p.id === item.product_id);
                return (
                  <div key={item.id} className="p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                      {itemProduct?.main_image_url ? (
                        <img 
                          src={itemProduct.main_image_url} 
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Sem foto
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Tam: {item.size}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Qtd:</Label>
                      <Input 
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => handleItemQtyChange(item.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Preço:</Label>
                      <CurrencyInput 
                        value={item.unit_price_cents}
                        onChange={(value) => handleItemPriceChange(item.id, value)}
                        className="w-24 h-8"
                      />
                    </div>

                    <div className="text-right min-w-[80px]">
                      <span className="font-medium text-sm">{formatPrice(item.line_total_cents)}</span>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveItem(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {editedItems.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  Nenhum item no pedido
                </div>
              )}
            </div>

            {/* Add New Item Form */}
            {showAddItem && (
              <div className="mt-3 p-3 border rounded-lg bg-secondary/30 space-y-3">
                <div>
                  <Label className="text-xs">Produto</Label>
                  <Select value={newProductId} onValueChange={setNewProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                              {product.main_image_url ? (
                                <img 
                                  src={product.main_image_url} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted" />
                              )}
                            </div>
                            <span className="truncate">{product.name} - {formatPrice(product.price_cents)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div className="flex items-center gap-3 p-2 bg-background rounded border">
                    <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                      {selectedProduct.main_image_url ? (
                        <img 
                          src={selectedProduct.main_image_url} 
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Sem foto
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
                      <p className="text-sm text-muted-foreground">{formatPrice(selectedProduct.price_cents)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tamanho</Label>
                    <Select value={newSize} onValueChange={setNewSize}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tam" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-[9999]">
                        {availableSizes.length > 0 ? (
                          availableSizes.map((size) => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__no-sizes" disabled>
                            Sem tamanhos cadastrados
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input 
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {selectedProduct && (
                    <div className="text-sm font-medium">
                      Total: {formatPrice(newQty * selectedProduct.price_cents)}
                    </div>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowAddItem(false)}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleAddNewItem}>
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Shipping */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CEP de Destino</Label>
              <Input 
                value={destCep} 
                onChange={(e) => setDestCep(e.target.value)}
                placeholder="00000-000"
              />
            </div>
            <div>
              <Label>Serviço de Frete</Label>
              <Input 
                value={shippingService} 
                onChange={(e) => setShippingService(e.target.value)}
                placeholder="PAC, SEDEX, etc."
              />
            </div>
          </div>
          
          <div className="w-48">
            <Label>Valor do Frete</Label>
            <CurrencyInput 
              value={shippingPriceCents}
              onChange={setShippingPriceCents}
            />
          </div>

          <Separator />

          {/* Observations */}
          <div>
            <Label>Observações</Label>
            <Textarea 
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações do pedido..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatPrice(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Frete:</span>
              <span>{shippingPriceCents ? formatPrice(shippingPriceCents) : 'A combinar'}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t pt-2">
              <span>Total:</span>
              <span>{formatPrice(calculateTotal())}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover item do pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover "{itemToDelete?.product_name}" (Tam: {itemToDelete?.size}) do pedido?
            Esta ação será aplicada ao salvar as alterações.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmRemoveItem}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
