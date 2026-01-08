import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Palette } from 'lucide-react';

const DEFAULT_SIZES = ['P', 'M', 'G', 'GG', 'XG'];
const DEFAULT_COLORS = [
  { name: 'Preto', value: '#000000' },
  { name: 'Branco', value: '#FFFFFF' },
  { name: 'Off White', value: '#f5f5dc' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Amarelo', value: '#EAB308' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Roxo', value: '#A855F7' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Marrom', value: '#92400E' },
  { name: 'Cinza', value: '#6B7280' },
  { name: 'Bege', value: '#D4A574' },
];

export interface VariantData {
  size: string;
  color?: string;
  stock_qty: number;
  sku?: string;
  id?: string;
}

interface VariantEditorProps {
  variants: VariantData[];
  onChange: (variants: VariantData[]) => void;
}

export function VariantEditor({ variants, onChange }: VariantEditorProps) {
  const [customSize, setCustomSize] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync selectedColors and selectedSizes when variants change (e.g., on edit load)
  useEffect(() => {
    if (variants.length > 0 && !initialized) {
      const colors = [...new Set(variants.map(v => v.color).filter(Boolean) as string[])];
      const sizes = [...new Set(variants.map(v => v.size))];
      setSelectedColors(colors);
      setSelectedSizes(sizes);
      setInitialized(true);
    }
  }, [variants, initialized]);

  // Rebuild variants when sizes or colors change
  const rebuildVariants = (sizes: string[], colors: string[]) => {
    const newVariants: VariantData[] = [];
    
    if (colors.length === 0) {
      // No colors selected - just use sizes
      sizes.forEach(size => {
        const existing = variants.find(v => v.size === size && !v.color);
        newVariants.push(existing || { size, stock_qty: 0 });
      });
    } else {
      // Create variant for each size+color combination
      sizes.forEach(size => {
        colors.forEach(color => {
          const existing = variants.find(v => v.size === size && v.color === color);
          newVariants.push(existing || { size, color, stock_qty: 0 });
        });
      });
    }
    
    onChange(newVariants);
  };

  const toggleSize = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter(s => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    rebuildVariants(newSizes, selectedColors);
  };

  const toggleColor = (color: string) => {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    setSelectedColors(newColors);
    rebuildVariants(selectedSizes, newColors);
  };

  const addCustomSize = () => {
    if (customSize.trim() && !selectedSizes.includes(customSize.trim().toUpperCase())) {
      const newSize = customSize.trim().toUpperCase();
      const newSizes = [...selectedSizes, newSize];
      setSelectedSizes(newSizes);
      rebuildVariants(newSizes, selectedColors);
      setCustomSize('');
    }
  };

  const addCustomColor = () => {
    if (customColor.trim() && !selectedColors.includes(customColor.trim())) {
      const newColor = customColor.trim();
      const newColors = [...selectedColors, newColor];
      setSelectedColors(newColors);
      rebuildVariants(selectedSizes, newColors);
      setCustomColor('');
    }
  };

  const removeCustomSize = (size: string) => {
    const newSizes = selectedSizes.filter(s => s !== size);
    setSelectedSizes(newSizes);
    rebuildVariants(newSizes, selectedColors);
  };

  const removeCustomColor = (color: string) => {
    const newColors = selectedColors.filter(c => c !== color);
    setSelectedColors(newColors);
    rebuildVariants(selectedSizes, newColors);
  };

  const updateVariant = (size: string, color: string | undefined, updates: Partial<VariantData>) => {
    onChange(
      variants.map(v => 
        v.size === size && v.color === color ? { ...v, ...updates } : v
      )
    );
  };

  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
  const sortedVariants = [...variants].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size);
    const indexB = sizeOrder.indexOf(b.size);
    if (indexA === -1 && indexB === -1) {
      const sizeCompare = a.size.localeCompare(b.size);
      if (sizeCompare !== 0) return sizeCompare;
      return (a.color || '').localeCompare(b.color || '');
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    if (indexA !== indexB) return indexA - indexB;
    return (a.color || '').localeCompare(b.color || '');
  });

  const getColorDisplay = (colorName: string) => {
    const preset = DEFAULT_COLORS.find(c => c.name === colorName);
    return preset?.value || '#888888';
  };

  const customSizes = selectedSizes.filter(s => !DEFAULT_SIZES.includes(s));
  const customColorsList = selectedColors.filter(c => !DEFAULT_COLORS.find(dc => dc.name === c));

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      <div>
        <Label className="mb-2 block">Tamanhos disponíveis</Label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedSizes.includes(size)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary'
              }`}
            >
              {size}
            </button>
          ))}
          {customSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => removeCustomSize(size)}
              className="px-4 py-2 rounded-lg border border-primary bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"
            >
              {size}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Tamanho customizado (ex: XXG)"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomSize}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <Label className="mb-2 block flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Cores disponíveis (opcional)
        </Label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => toggleColor(color.name)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                selectedColors.includes(color.name)
                  ? 'border-primary ring-2 ring-primary ring-offset-1'
                  : 'border-border hover:border-primary'
              }`}
            >
              <span 
                className="w-4 h-4 rounded-full border border-border" 
                style={{ backgroundColor: color.value }}
              />
              {color.name}
            </button>
          ))}
          {customColorsList.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => removeCustomColor(color)}
              className="px-3 py-2 rounded-lg border border-primary ring-2 ring-primary ring-offset-1 text-sm font-medium flex items-center gap-2"
            >
              <span className="w-4 h-4 rounded-full bg-muted border border-border" />
              {color}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Cor customizada (ex: Vinho)"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomColor())}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomColor}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Variant Details */}
      {sortedVariants.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <Label>Estoque por variação</Label>
          {sortedVariants.map((variant) => (
            <div key={`${variant.size}-${variant.color || 'no-color'}`} className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg flex-wrap">
              <div className="flex items-center gap-2 min-w-[100px]">
                <span className="font-medium">{variant.size}</span>
                {variant.color && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span 
                      className="w-4 h-4 rounded-full border border-border" 
                      style={{ backgroundColor: getColorDisplay(variant.color) }}
                    />
                    <span className="text-sm">{variant.color}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Estoque:</Label>
                <Input
                  type="number"
                  min={0}
                  value={variant.stock_qty}
                  onChange={(e) => updateVariant(variant.size, variant.color, { 
                    stock_qty: Math.max(0, parseInt(e.target.value) || 0) 
                  })}
                  className="w-20"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">SKU:</Label>
                <Input
                  placeholder="Opcional"
                  value={variant.sku || ''}
                  onChange={(e) => updateVariant(variant.size, variant.color, { sku: e.target.value })}
                  className="w-32"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
