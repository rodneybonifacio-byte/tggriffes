import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StoreHeader } from '@/components/store/StoreHeader';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductFilters } from '@/components/store/ProductFilters';
import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { PromoBanner } from '@/components/store/PromoBanner';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { Loader2, LayoutGrid, Square, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [gridCols, setGridCols] = useState<1 | 2>(2);

  // Sync category from URL
  const selectedCategory = searchParams.get('category') || undefined;

  const { data: categories = [] } = useCategories();
  const { data: products = [], isLoading } = useProducts({
    search,
    categoryId: categories.find(c => c.slug === selectedCategory)?.id,
    stock: inStockOnly ? 'in-stock' : 'all',
    status: 'active',
  });

  // Filter and sort products
  let filteredProducts = products.filter(product => {
    // Price filter
    if (product.price_cents < priceRange[0] || product.price_cents > priceRange[1]) {
      return false;
    }

    // Size filter
    if (selectedSizes.length > 0) {
      const productSizes = product.product_variants?.map(v => v.size.toUpperCase()) || [];
      const hasMatchingSize = selectedSizes.some(size => 
        productSizes.includes(size.toUpperCase())
      );
      if (!hasMatchingSize) return false;
    }

    return true;
  });

  // Helper function to calculate total stock
  const getTotalStock = (product: typeof filteredProducts[0]) => 
    product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;

  // Sort products - default by stock (most items first)
  if (sortBy === 'relevance') {
    // Default: sort by stock quantity (most items first)
    filteredProducts = [...filteredProducts].sort((a, b) => getTotalStock(b) - getTotalStock(a));
  } else if (sortBy === 'stock-asc') {
    filteredProducts = [...filteredProducts].sort((a, b) => getTotalStock(a) - getTotalStock(b));
  } else if (sortBy === 'price-asc') {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price_cents - b.price_cents);
  } else if (sortBy === 'price-desc') {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price_cents - a.price_cents);
  } else if (sortBy === 'newest') {
    filteredProducts = [...filteredProducts].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else if (sortBy === 'color') {
    filteredProducts = [...filteredProducts].sort((a, b) => {
      const colorA = a.product_variants?.[0]?.color?.toLowerCase() || 'zzz';
      const colorB = b.product_variants?.[0]?.color?.toLowerCase() || 'zzz';
      return colorA.localeCompare(colorB, 'pt-BR');
    });
  }

  const handleSearch = (query: string) => {
    setSearch(query);
    if (query) {
      searchParams.set('search', query);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const handleCategoryChange = (slug: string | undefined) => {
    if (slug) {
      searchParams.set('category', slug);
    } else {
      searchParams.delete('category');
    }
    setSearchParams(searchParams);
  };

  const clearFilters = () => {
    setSelectedSizes([]);
    setPriceRange([0, 50000]);
    setInStockOnly(false);
    setSearch('');
    searchParams.delete('category');
    searchParams.delete('search');
    setSearchParams(searchParams);
  };

  // Calculate max price for slider
  const maxPrice = Math.max(...products.map(p => p.price_cents), 50000);

  // Check if any filter is active
  const hasActiveFilters = selectedCategory || selectedSizes.length > 0 || inStockOnly || priceRange[0] > 0 || priceRange[1] < maxPrice || search;

  // Get unique categories that are actually used by products
  const usedCategories = useMemo(() => {
    const usedCategoryIds = new Set(products.map(p => p.category_id).filter(Boolean));
    return categories.filter(c => usedCategoryIds.has(c.id));
  }, [products, categories]);

  // Get unique sizes from all product variants, sorted
  const availableSizes = useMemo(() => {
    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const sizes = new Set<string>();
    products.forEach(product => {
      product.product_variants?.forEach(variant => {
        sizes.add(variant.size.toUpperCase());
      });
    });
    return Array.from(sizes).sort((a, b) => {
      const indexA = sizeOrder.indexOf(a);
      const indexB = sizeOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [products]);

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader onSearch={handleSearch} searchValue={search} />
      <PromoBanner />
      

      <main className="container py-4 md:py-6">
        {/* Active filters indicator with clear button */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                {categories.find(c => c.slug === selectedCategory)?.name}
                <button onClick={() => handleCategoryChange(undefined)} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSizes.map(size => (
              <span key={size} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                {size}
                <button onClick={() => setSelectedSizes(prev => prev.filter(s => s !== size))} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {search && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                "{search}"
                <button onClick={() => { setSearch(''); searchParams.delete('search'); setSearchParams(searchParams); }} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
              Limpar tudo
            </Button>
          </div>
        )}

        {/* Mobile: Filters + Sort in one row */}
        <div className="flex items-center justify-between gap-3 mb-4 lg:hidden">
          <ProductFilters
            categories={usedCategories}
            availableSizes={availableSizes}
            selectedCategory={selectedCategory}
            selectedSizes={selectedSizes}
            priceRange={priceRange}
            maxPrice={maxPrice}
            inStockOnly={inStockOnly}
            onCategoryChange={handleCategoryChange}
            onSizeChange={setSelectedSizes}
            onPriceChange={setPriceRange}
            onInStockChange={setInStockOnly}
            onClearFilters={clearFilters}
          />
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filteredProducts.length}</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setGridCols(2)}
                className={cn(
                  "p-2 transition-colors",
                  gridCols === 2 ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
                aria-label="2 colunas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGridCols(1)}
                className={cn(
                  "p-2 transition-colors border-l",
                  gridCols === 1 ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
                aria-label="1 coluna"
              >
                <Square className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop Filters */}
          <div className="hidden lg:block">
            <ProductFilters
              categories={usedCategories}
              availableSizes={availableSizes}
              selectedCategory={selectedCategory}
              selectedSizes={selectedSizes}
              priceRange={priceRange}
              maxPrice={maxPrice}
              inStockOnly={inStockOnly}
              onCategoryChange={handleCategoryChange}
              onSizeChange={setSelectedSizes}
              onPriceChange={setPriceRange}
              onInStockChange={setInStockOnly}
              onClearFilters={clearFilters}
            />
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Desktop Sort & Results Count */}
            <div className="hidden lg:flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
              </p>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ordenar:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Mais em estoque</SelectItem>
                    <SelectItem value="stock-asc">Menos em estoque</SelectItem>
                    <SelectItem value="newest">Mais recentes</SelectItem>
                    <SelectItem value="price-asc">Menor preço</SelectItem>
                    <SelectItem value="price-desc">Maior preço</SelectItem>
                    <SelectItem value="color">Por cor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg text-muted-foreground">Nenhum produto encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tente ajustar os filtros ou a busca
                </p>
              </div>
            ) : (
              <div className={cn(
                "grid gap-2 md:gap-4",
                gridCols === 1 ? "grid-cols-1" : "grid-cols-2",
                "lg:grid-cols-3 xl:grid-cols-4"
              )}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating WhatsApp Button */}
      <WhatsAppButton floating />
    </div>
  );
};

export default Index;
