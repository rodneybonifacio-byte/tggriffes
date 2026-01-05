import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';

const DEFAULT_SIZES = ['P', 'M', 'G', 'GG', 'XG'];

export interface VariantData {
  size: string;
  stock_qty: number;
  sku?: string;
}

interface VariantEditorProps {
  variants: VariantData[];
  onChange: (variants: VariantData[]) => void;
}

export function VariantEditor({ variants, onChange }: VariantEditorProps) {
  const [customSize, setCustomSize] = useState('');

  const selectedSizes = new Set(variants.map(v => v.size));

  const toggleSize = (size: string) => {
    if (selectedSizes.has(size)) {
      onChange(variants.filter(v => v.size !== size));
    } else {
      onChange([...variants, { size, stock_qty: 0 }]);
    }
  };

  const addCustomSize = () => {
    if (customSize.trim() && !selectedSizes.has(customSize.trim().toUpperCase())) {
      const newSize = customSize.trim().toUpperCase();
      onChange([...variants, { size: newSize, stock_qty: 0 }]);
      setCustomSize('');
    }
  };

  const updateVariant = (size: string, updates: Partial<VariantData>) => {
    onChange(
      variants.map(v => 
        v.size === size ? { ...v, ...updates } : v
      )
    );
  };

  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
  const sortedVariants = [...variants].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size);
    const indexB = sizeOrder.indexOf(b.size);
    if (indexA === -1 && indexB === -1) return a.size.localeCompare(b.size);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="space-y-4">
      {/* Size Checkboxes */}
      <div>
        <Label className="mb-2 block">Tamanhos disponíveis</Label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedSizes.has(size)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Add Custom Size */}
      <div className="flex gap-2">
        <Input
          placeholder="Tamanho customizado (ex: XXG)"
          value={customSize}
          onChange={(e) => setCustomSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
        />
        <Button type="button" variant="outline" onClick={addCustomSize}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Variant Details */}
      {sortedVariants.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <Label>Estoque por tamanho</Label>
          {sortedVariants.map((variant) => (
            <div key={variant.size} className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg">
              <span className="font-medium w-12">{variant.size}</span>
              
              <div className="flex-1 flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Estoque:</Label>
                <Input
                  type="number"
                  min={0}
                  value={variant.stock_qty}
                  onChange={(e) => updateVariant(variant.size, { 
                    stock_qty: Math.max(0, parseInt(e.target.value) || 0) 
                  })}
                  className="w-20"
                />
              </div>

              <div className="flex-1 flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">SKU:</Label>
                <Input
                  placeholder="Opcional"
                  value={variant.sku || ''}
                  onChange={(e) => updateVariant(variant.size, { sku: e.target.value })}
                  className="w-32"
                />
              </div>

              {!DEFAULT_SIZES.includes(variant.size) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(variants.filter(v => v.size !== variant.size))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
