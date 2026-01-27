import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CurrencyInput } from './CurrencyInput';
import { formatPrice, getColorDisplayName } from '@/lib/utils';
import { 
  CheckSquare, 
  Square, 
  Percent, 
  DollarSign, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  Wand2,
  RotateCcw,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tables } from '@/integrations/supabase/types';

type OrderItem = Tables<'order_intent_items'> & { color?: string | null };

interface BulkEditPanelProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  onDeleteItems: (ids: string[]) => void;
  products?: Array<{ id: string; main_image_url?: string | null }>;
}

type BulkAction = 'price-fixed' | 'price-percent' | 'qty-fixed' | 'qty-add' | 'qty-subtract';

export function BulkEditPanel({ items, onItemsChange, onDeleteItems, products = [] }: BulkEditPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkValue, setBulkValue] = useState<number>(0);
  const [bulkPriceCents, setBulkPriceCents] = useState<number>(0);
  
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const selectedItems = useMemo(() => 
    items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const selectedTotal = useMemo(() => 
    selectedItems.reduce((sum, item) => sum + item.line_total_cents, 0),
    [selectedItems]
  );

  const selectedQty = useMemo(() => 
    selectedItems.reduce((sum, item) => sum + item.qty, 0),
    [selectedItems]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const applyBulkAction = () => {
    if (!bulkAction || selectedIds.size === 0) return;

    const updatedItems = items.map(item => {
      if (!selectedIds.has(item.id)) return item;

      let newQty = item.qty;
      let newPriceCents = item.unit_price_cents;

      switch (bulkAction) {
        case 'price-fixed':
          newPriceCents = bulkPriceCents;
          break;
        case 'price-percent':
          newPriceCents = Math.round(item.unit_price_cents * (1 + bulkValue / 100));
          break;
        case 'qty-fixed':
          newQty = Math.max(1, bulkValue);
          break;
        case 'qty-add':
          newQty = item.qty + bulkValue;
          break;
        case 'qty-subtract':
          newQty = Math.max(1, item.qty - bulkValue);
          break;
      }

      return {
        ...item,
        qty: newQty,
        unit_price_cents: newPriceCents,
        line_total_cents: newQty * newPriceCents,
      };
    });

    onItemsChange(updatedItems);
    setBulkAction(null);
    setBulkValue(0);
    setBulkPriceCents(0);
  };

  const handleDeleteSelected = () => {
    onDeleteItems(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAction(null);
  };

  const getProductImage = (productId?: string | null) => {
    const product = products.find(p => p.id === productId);
    return product?.main_image_url;
  };

  return (
    <div className="space-y-3">
      {/* Selection Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
              allSelected 
                ? "bg-primary text-primary-foreground border-primary" 
                : someSelected
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-muted border-border hover:border-primary/50"
            )}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {allSelected ? 'Todos' : someSelected ? `${selectedCount}/${items.length}` : 'Selecionar'}
            </span>
          </button>

          <AnimatePresence>
            {selectedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <Badge variant="secondary" className="px-3 py-1">
                  <span className="font-bold">{selectedQty}</span>
                  <span className="ml-1 text-muted-foreground">peças</span>
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-green-600 border-green-200 bg-green-50">
                  {formatPrice(selectedTotal)}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Ações em Massa</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <ActionButton
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Preço Fixo"
                  active={bulkAction === 'price-fixed'}
                  onClick={() => setBulkAction(bulkAction === 'price-fixed' ? null : 'price-fixed')}
                />
                <ActionButton
                  icon={<Percent className="h-3.5 w-3.5" />}
                  label="% Preço"
                  active={bulkAction === 'price-percent'}
                  onClick={() => setBulkAction(bulkAction === 'price-percent' ? null : 'price-percent')}
                />
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ActionButton
                  icon={<span className="text-xs font-bold">=</span>}
                  label="Qtd Fixa"
                  active={bulkAction === 'qty-fixed'}
                  onClick={() => setBulkAction(bulkAction === 'qty-fixed' ? null : 'qty-fixed')}
                />
                <ActionButton
                  icon={<Plus className="h-3.5 w-3.5" />}
                  label="Adicionar"
                  active={bulkAction === 'qty-add'}
                  onClick={() => setBulkAction(bulkAction === 'qty-add' ? null : 'qty-add')}
                />
                <ActionButton
                  icon={<Minus className="h-3.5 w-3.5" />}
                  label="Subtrair"
                  active={bulkAction === 'qty-subtract'}
                  onClick={() => setBulkAction(bulkAction === 'qty-subtract' ? null : 'qty-subtract')}
                />
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ActionButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Excluir"
                  variant="destructive"
                  onClick={handleDeleteSelected}
                />
              </div>

              {/* Action Input */}
              <AnimatePresence mode="wait">
                {bulkAction && (
                  <motion.div
                    key={bulkAction}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                  >
                    <div className="flex-1">
                      {bulkAction === 'price-fixed' ? (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Novo preço:</Label>
                          <CurrencyInput
                            value={bulkPriceCents}
                            onChange={setBulkPriceCents}
                            className="w-32 h-9"
                          />
                        </div>
                      ) : bulkAction === 'price-percent' ? (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Ajuste:</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={bulkValue}
                              onChange={(e) => setBulkValue(parseFloat(e.target.value) || 0)}
                              className="w-24 h-9 pr-7"
                              placeholder="-10 ou +20"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {bulkValue > 0 ? 'aumentar' : bulkValue < 0 ? 'reduzir' : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">
                            {bulkAction === 'qty-fixed' ? 'Nova quantidade:' : 'Quantidade:'}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={bulkValue}
                            onChange={(e) => setBulkValue(parseInt(e.target.value) || 0)}
                            className="w-20 h-9"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setBulkAction(null)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={applyBulkAction}
                        className="gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Aplicar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items List */}
      <div className="border rounded-xl overflow-hidden divide-y">
        {items.map((item, index) => {
          const isSelected = selectedIds.has(item.id);
          const imageUrl = getProductImage(item.product_id);
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => toggleSelect(item.id)}
              className={cn(
                "p-3 flex items-center gap-3 cursor-pointer transition-all",
                isSelected 
                  ? "bg-primary/5 hover:bg-primary/10" 
                  : "hover:bg-muted/50"
              )}
            >
              {/* Checkbox */}
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                isSelected 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>

              {/* Image */}
              <div className={cn(
                "w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-2 transition-all",
                isSelected ? "ring-primary" : "ring-transparent"
              )}>
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    📦
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.color && (
                    <span className="flex items-center gap-1">
                      <span 
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ backgroundColor: item.color }}
                      />
                      {getColorDisplayName(item.color)}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {item.size}
                  </Badge>
                </div>
              </div>

              {/* Quantity */}
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{item.qty}</div>
                <div className="text-[10px] text-muted-foreground uppercase">peças</div>
              </div>

              {/* Unit Price */}
              <div className="text-right min-w-[70px]">
                <div className="text-xs text-muted-foreground">unit.</div>
                <div className="text-sm font-medium text-green-600">{formatPrice(item.unit_price_cents)}</div>
              </div>

              {/* Total */}
              <div className="text-right min-w-[80px]">
                <div className="text-xs text-muted-foreground">total</div>
                <div className="font-bold">{formatPrice(item.line_total_cents)}</div>
              </div>
            </motion.div>
          );
        })}

        {items.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum item no pedido
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for action buttons
function ActionButton({ 
  icon, 
  label, 
  active, 
  variant = 'default',
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean;
  variant?: 'default' | 'destructive';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
        variant === 'destructive'
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
          : active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-background border hover:bg-muted"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
