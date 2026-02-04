import { useState, useEffect, useMemo } from 'react';
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
import { useApplicablePromotions, calculatePromotionDiscount } from '@/hooks/usePromotions';
import { formatPrice, getColorDisplayName } from '@/lib/utils';
import { CurrencyInput } from './CurrencyInput';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus, Save, Tag } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { BulkEditPanel } from './BulkEditPanel';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  preto: '#000000',
  branco: '#FFFFFF',
  azul: '#2563eb',
  vermelho: '#dc2626',
  verde: '#16a34a',
  amarelo: '#eab308',
  rosa: '#ec4899',
  roxo: '#9333ea',
  laranja: '#f97316',
  marrom: '#78350f',
  cinza: '#6b7280',
  bege: '#d4a574',
  vinho: '#722f37',
  bordo: '#800020',
  burgundy: '#800020',
  navy: '#000080',
  marinho: '#000080',
  creme: '#fffdd0',
  off: '#f5f5dc',
  offwhite: '#f5f5dc',
  'off-white': '#f5f5dc',
  'off white': '#f5f5dc',
  caramelo: '#a0522d',
  mostarda: '#e4a010',
  oliva: '#808000',
  coral: '#ff7f50',
  salmao: '#fa8072',
  salmon: '#fa8072',
  turquesa: '#40e0d0',
  aqua: '#00ffff',
  lilas: '#c8a2c8',
  lavanda: '#e6e6fa',
  grafite: '#474747',
  chumbo: '#4a4a4a',
  nude: '#e3bc9a',
  terracota: '#e2725b',
  pessego: '#ffcba4',
  menta: '#98ff98',
  oceano: '#1e90ff',
  jeans: '#4169e1',
  cafe: '#6f4e37',
  chocolate: '#7b3f00',
  ouro: '#ffd700',
  prata: '#c0c0c0',
  bronze: '#cd7f32',
  cobre: '#b87333',
};

const isLightColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
};

const findColorHex = (colorName: string): string => {
  const normalized = colorName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
  
  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
  
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return '#888888';
};
interface OrderEditModalProps {
  order: OrderIntent | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type OrderItem = Tables<'order_intent_items'> & { color?: string | null };

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
  const [newColor, setNewColor] = useState('');
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
    setNewColor('');
    setNewSize('');
  }, [newProductId]);

  useEffect(() => {
    setNewSize('');
  }, [newColor]);

  const totalItems = useMemo(() => 
    editedItems.reduce((sum, item) => sum + item.qty, 0), 
    [editedItems]
  );

  const subtotalCents = useMemo(() => 
    editedItems.reduce((sum, item) => sum + item.line_total_cents, 0), 
    [editedItems]
  );

  const { data: applicablePromotion } = useApplicablePromotions(totalItems);
  
  const promotionResult = useMemo(() => 
    calculatePromotionDiscount(applicablePromotion || null, subtotalCents, totalItems),
    [applicablePromotion, subtotalCents, totalItems]
  );

  const calculateSubtotal = () => subtotalCents;

  const calculateTotal = () => {
    return promotionResult.finalCents + (shippingPriceCents || 0);
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
    const hasColors = availableColors.length > 0;
    
    if (!newProductId || !newSize || newQty < 1 || (hasColors && !newColor)) {
      toast({ title: 'Preencha todos os campos do item', variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id === newProductId);
    if (!product) return;

    // Find the matching variant
    const variant = product.product_variants?.find(v => 
      v.size === newSize && (hasColors ? v.color === newColor : !v.color)
    );

    const colorToAdd = hasColors ? newColor : null;

    // Check if item with same product, size and color already exists
    const existingIndex = editedItems.findIndex(item => 
      item.product_id === product.id && 
      item.size === newSize && 
      item.color === colorToAdd
    );

    if (existingIndex >= 0) {
      // Merge: add quantity to existing item
      setEditedItems(items => 
        items.map((item, index) => {
          if (index === existingIndex) {
            const newTotalQty = item.qty + newQty;
            return {
              ...item,
              qty: newTotalQty,
              line_total_cents: newTotalQty * item.unit_price_cents,
            };
          }
          return item;
        })
      );
      toast({ title: `Quantidade adicionada ao item existente` });
    } else {
      // Add new item
      const newItem: OrderItem = {
        id: `new-${Date.now()}`,
        order_intent_id: order!.id,
        product_id: product.id,
        product_name: product.name,
        variant_id: variant?.id || null,
        size: newSize,
        color: colorToAdd,
        qty: newQty,
        unit_price_cents: product.price_cents,
        line_total_cents: newQty * product.price_cents,
        created_at: new Date().toISOString(),
        added_from: 'catalog',
      };
      setEditedItems([...editedItems, newItem]);
    }

    setShowAddItem(false);
    setNewProductId('');
    setNewColor('');
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
        const colorInfo = item.color ? `${getColorDisplayName(item.color)} / ` : '';
        changes.push(`Adicionado: ${item.product_name} (${colorInfo}${item.size}) x${item.qty}`);
        await addItem({
          order_intent_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_id: item.variant_id,
          size: item.size,
          color: item.color || null,
          qty: item.qty,
          unit_price_cents: item.unit_price_cents,
          line_total_cents: item.line_total_cents,
        } as Parameters<typeof addItem>[0]);
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
  
  const availableColors = (() => {
    const colors = Array.from(
      new Set((selectedProduct?.product_variants || []).map(v => v.color).filter(Boolean) as string[])
    );
    return colors.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  })();

  const availableSizes = (() => {
    const variants = selectedProduct?.product_variants || [];
    // If there are colors, filter sizes by selected color
    const filteredVariants = availableColors.length > 0 && newColor
      ? variants.filter(v => v.color === newColor)
      : variants;
    
    const sizes = Array.from(new Set(filteredVariants.map(v => v.size)));
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

          {/* Items with Bulk Edit */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Itens do Pedido</Label>

            <BulkEditPanel
              items={editedItems}
              onItemsChange={setEditedItems}
              onDeleteItems={(ids) => {
                setEditedItems(items => items.filter(item => !ids.includes(item.id)));
              }}
              products={products.map(p => ({ id: p.id, main_image_url: p.main_image_url }))}
            />

            {/* Add New Item Button - Below existing items */}
            {!showAddItem && (
              <Button 
                variant="outline" 
                className="w-full mt-3 border-dashed"
                onClick={() => setShowAddItem(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            )}

            {/* Add New Item Form */}
            {showAddItem && (
              <div className="mt-3 p-4 border rounded-lg bg-secondary/30 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Adicionar Novo Item</Label>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setShowAddItem(false);
                      setNewProductId('');
                      setNewColor('');
                      setNewSize('');
                      setNewQty(1);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                
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
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted" />
                              )}
                            </div>
                            <span className="truncate">{product.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Product Display with Large Image and Catalog-style Grid */}
                {selectedProduct && (
                  <div className="space-y-4">
                    {/* Large product image and info */}
                    <div className="flex items-start gap-4 p-3 bg-background rounded-lg border">
                      <div className="w-28 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
                        <p className="font-semibold truncate">{selectedProduct.name}</p>
                        {selectedProduct.categories && (
                          <p className="text-xs text-muted-foreground mt-0.5">{selectedProduct.categories.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Catalog-style variant grid */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Selecione as variantes:</Label>
                      {(() => {
                        const variants = selectedProduct.product_variants || [];
                        const colors = availableColors;
                        const sizes = availableSizes;

                        // Build items array sorted by color first, then by size
                        const items = colors.length > 0
                          ? colors.flatMap((color) =>
                              sizes.map((size) => {
                                const variant = variants.find(v => v.size === size && v.color === color);
                                if (!variant) return null;
                                return { color, size, variant };
                              }).filter(Boolean)
                            )
                          : sizes.map((size) => {
                              const variant = variants.find((v) => v.size === size);
                              if (!variant) return null;
                              return { color: null as string | null, size, variant };
                            }).filter(Boolean);

                        // Get current quantities being added
                        const getAddQtyForVariant = (variantId: string) => {
                          // Find if there's already a pending new item with this variant
                          const existingNewItem = editedItems.find(
                            item => item.id.startsWith('new-') && item.variant_id === variantId
                          );
                          return existingNewItem?.qty || 0;
                        };

                        const handleAddVariant = (color: string | null, size: string, variant: { id: string; stock_qty: number }) => {
                          const existingIndex = editedItems.findIndex(item => 
                            item.product_id === selectedProduct.id && 
                            item.size === size && 
                            item.color === color
                          );

                          if (existingIndex >= 0) {
                            const existingItem = editedItems[existingIndex];
                            const currentQty = existingItem.qty;
                            const stockQty = variant.stock_qty;
                            
                            if (currentQty >= stockQty) {
                              toast({ title: 'Limite de estoque atingido', variant: 'destructive' });
                              return;
                            }

                            setEditedItems(items => 
                              items.map((item, index) => {
                                if (index === existingIndex) {
                                  const newTotalQty = item.qty + 1;
                                  return {
                                    ...item,
                                    qty: newTotalQty,
                                    line_total_cents: newTotalQty * item.unit_price_cents,
                                  };
                                }
                                return item;
                              })
                            );
                          } else {
                            const newItem: OrderItem = {
                              id: `new-${Date.now()}-${Math.random()}`,
                              order_intent_id: order!.id,
                              product_id: selectedProduct.id,
                              product_name: selectedProduct.name,
                              variant_id: variant.id,
                              size: size,
                              color: color,
                              qty: 1,
                              unit_price_cents: selectedProduct.price_cents,
                              line_total_cents: selectedProduct.price_cents,
                              added_from: 'catalog',
                              created_at: new Date().toISOString(),
                            };
                            setEditedItems([...editedItems, newItem]);
                          }
                          toast({ title: 'Item adicionado!' });
                        };

                        const handleRemoveVariant = (color: string | null, size: string) => {
                          const existingIndex = editedItems.findIndex(item => 
                            item.product_id === selectedProduct.id && 
                            item.size === size && 
                            item.color === color
                          );

                          if (existingIndex >= 0) {
                            const existingItem = editedItems[existingIndex];
                            if (existingItem.qty <= 1) {
                              setEditedItems(items => items.filter((_, i) => i !== existingIndex));
                            } else {
                              setEditedItems(items => 
                                items.map((item, index) => {
                                  if (index === existingIndex) {
                                    const newTotalQty = item.qty - 1;
                                    return {
                                      ...item,
                                      qty: newTotalQty,
                                      line_total_cents: newTotalQty * item.unit_price_cents,
                                    };
                                  }
                                  return item;
                                })
                              );
                            }
                          }
                        };

                        return items.map((item) => {
                          if (!item) return null;
                          const { color, size, variant } = item;

                          // Get quantity in editedItems for this variant
                          const quantityInOrder = (() => {
                            const found = editedItems.find(i => 
                              i.product_id === selectedProduct.id && 
                              i.size === size && 
                              i.color === color
                            );
                            return found?.qty || 0;
                          })();

                          const remaining = Math.max(0, variant.stock_qty - quantityInOrder);
                          const colorHex = color ? findColorHex(color) : null;
                          const needsBorder = colorHex ? isLightColor(colorHex) : false;

                          const isLastOne = remaining === 1;
                          const isLowStock = remaining > 1 && remaining <= 3;
                          const isMaxed = remaining === 0 && quantityInOrder > 0;
                          const isSoldOut = variant.stock_qty === 0 && quantityInOrder === 0;

                          const rowTone = (() => {
                            if (quantityInOrder > 0) return "border-success/40 bg-success/10";
                            if (isLastOne) return "border-destructive/40 bg-destructive/10";
                            if (isLowStock) return "border-warning/40 bg-warning/10";
                            if (isSoldOut) return "border-border/40 bg-muted/60 opacity-70";
                            return "border-border/60 bg-background";
                          })();

                          const stockLabel = (() => {
                            if (remaining === 0) return isMaxed ? "Máx!" : "0";
                            if (remaining === 1) return "🔥 1";
                            if (remaining <= 3) return `⚡ ${remaining}`;
                            return `${remaining}`;
                          })();

                          const stockColor = (() => {
                            if (remaining === 0) return isMaxed ? "text-amber-600 font-bold" : "text-muted-foreground";
                            if (remaining === 1) return "text-red-600 font-bold";
                            if (remaining <= 3) return "text-amber-600 font-semibold";
                            return "text-emerald-600 font-semibold";
                          })();

                          return (
                            <div
                              key={`${color || "default"}-${size}`}
                              className={cn(
                                "flex items-center justify-between min-h-10 rounded-md border px-2 py-1.5 transition-colors",
                                rowTone
                              )}
                            >
                              {/* Left: swatch + tamanho + estoque inline */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {colorHex && (
                                  <div
                                    className={cn(
                                      "w-4 h-4 rounded-full shrink-0",
                                      needsBorder && "border border-border"
                                    )}
                                    style={{ backgroundColor: colorHex }}
                                    title={getColorDisplayName(color!)}
                                  />
                                )}
                                {color && (
                                  <span className="text-xs truncate max-w-20">{getColorDisplayName(color)}</span>
                                )}
                                <span className="text-sm font-bold shrink-0">{size}</span>
                                <span className={cn("text-xs truncate", stockColor)}>
                                  {stockLabel} disp.
                                </span>
                              </div>

                              {/* Right: +/- controls */}
                              <div className="flex items-center gap-1 shrink-0">
                                {quantityInOrder > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariant(color, size)}
                                      className="w-7 h-7 rounded-full bg-destructive/15 text-destructive flex items-center justify-center active:scale-95 transition-transform"
                                      aria-label="Remover"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-5 text-center text-sm font-bold text-success">
                                      {quantityInOrder}
                                    </span>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleAddVariant(color, size, variant)}
                                  disabled={remaining === 0}
                                  className={cn(
                                    "w-7 h-7 rounded-full bg-success text-success-foreground flex items-center justify-center active:scale-95 transition-transform",
                                    "disabled:bg-muted disabled:text-muted-foreground"
                                  )}
                                  aria-label="Adicionar"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Done button */}
                    <Button 
                      className="w-full"
                      onClick={() => {
                        setShowAddItem(false);
                        setNewProductId('');
                        setNewColor('');
                        setNewSize('');
                        setNewQty(1);
                      }}
                    >
                      Concluído
                    </Button>
                  </div>
                )}
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
              <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'}):</span>
              <span>{formatPrice(calculateSubtotal())}</span>
            </div>
            {promotionResult.discountCents > 0 && applicablePromotion && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {applicablePromotion.name}:
                </span>
                <span>-{formatPrice(promotionResult.discountCents)}</span>
              </div>
            )}
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
