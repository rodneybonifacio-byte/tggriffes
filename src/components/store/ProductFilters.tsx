import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import { Category } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

interface ProductFiltersProps {
  categories: Category[];
  selectedCategory?: string;
  selectedSizes: string[];
  priceRange: [number, number];
  maxPrice: number;
  inStockOnly: boolean;
  onCategoryChange: (categorySlug: string | undefined) => void;
  onSizeChange: (sizes: string[]) => void;
  onPriceChange: (range: [number, number]) => void;
  onInStockChange: (inStock: boolean) => void;
  onClearFilters: () => void;
}

const AVAILABLE_SIZES = ['P', 'M', 'G', 'GG', 'XG'];

export function ProductFilters({
  categories,
  selectedCategory,
  selectedSizes,
  priceRange,
  maxPrice,
  inStockOnly,
  onCategoryChange,
  onSizeChange,
  onPriceChange,
  onInStockChange,
  onClearFilters,
}: ProductFiltersProps) {
  const hasActiveFilters = selectedCategory || selectedSizes.length > 0 || inStockOnly || priceRange[0] > 0 || priceRange[1] < maxPrice;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div className="space-y-3">
        <Label className="font-semibold">Categorias</Label>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat.id}`}
                checked={selectedCategory === cat.slug}
                onCheckedChange={() => 
                  onCategoryChange(selectedCategory === cat.slug ? undefined : cat.slug)
                }
              />
              <label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">
                {cat.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div className="space-y-3">
        <Label className="font-semibold">Tamanhos</Label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => {
                const newSizes = selectedSizes.includes(size)
                  ? selectedSizes.filter((s) => s !== size)
                  : [...selectedSizes, size];
                onSizeChange(newSizes);
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                selectedSizes.includes(size)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="font-semibold">Preço</Label>
        <Slider
          value={priceRange}
          min={0}
          max={maxPrice}
          step={100}
          onValueChange={(value) => onPriceChange(value as [number, number])}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      {/* In Stock */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="in-stock"
          checked={inStockOnly}
          onCheckedChange={(checked) => onInStockChange(checked === true)}
        />
        <label htmlFor="in-stock" className="text-sm cursor-pointer">
          Apenas com estoque
        </label>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Filters */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-32 space-y-6">
          <h2 className="font-display text-lg font-semibold">Filtros</h2>
          <FilterContent />
        </div>
      </div>

      {/* Mobile Filter Button */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                !
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
