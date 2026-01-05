import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Product, ProductVariant, useUpdateVariantStock } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface StockModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function StockModal({ product, open, onClose }: StockModalProps) {
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const { mutateAsync: updateStock, isPending } = useUpdateVariantStock();
  const { toast } = useToast();

  const handleOpen = () => {
    if (product?.product_variants) {
      const initialStocks: Record<string, number> = {};
      product.product_variants.forEach((v) => {
        initialStocks[v.id] = v.stock_qty;
      });
      setStocks(initialStocks);
    }
  };

  const handleSave = async () => {
    const updates = Object.entries(stocks).map(([id, stock_qty]) => ({
      id,
      stock_qty,
    }));

    try {
      await updateStock(updates);
      toast({
        title: 'Estoque atualizado',
        description: 'As quantidades foram salvas com sucesso.',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o estoque.',
        variant: 'destructive',
      });
    }
  };

  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
  const sortedVariants = [...(product?.product_variants || [])].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size.toUpperCase());
    const indexB = sizeOrder.indexOf(b.size.toUpperCase());
    if (indexA === -1 && indexB === -1) return a.size.localeCompare(b.size);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle>Estoque Rápido - {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {sortedVariants.map((variant) => (
            <div key={variant.id} className="flex items-center gap-4">
              <Label className="w-16 font-medium">{variant.size}</Label>
              <Input
                type="number"
                min={0}
                value={stocks[variant.id] ?? variant.stock_qty}
                onChange={(e) => {
                  const value = Math.max(0, parseInt(e.target.value) || 0);
                  setStocks((prev) => ({ ...prev, [variant.id]: value }));
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">unidades</span>
            </div>
          ))}

          {sortedVariants.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma variação cadastrada para este produto.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
