import { useState, useMemo, useCallback } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useProducts, useCategories, useUpdateVariantStock, Product, ProductVariant } from '@/hooks/useProducts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Save, 
  Loader2, 
  Package, 
  AlertTriangle,
  Plus,
  Minus,
  RotateCcw,
  Filter,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Size order for sorting
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'U'];

// Compact stock adjustment component
function StockAdjuster({
  currentStock,
  newStock,
  hasChange,
  diff,
  onAdjust,
}: {
  currentStock: number;
  newStock: number;
  hasChange: boolean;
  diff: number;
  onAdjust: (amount: number) => void;
}) {
  const [qty, setQty] = useState<string>('1');

  const handleAdd = () => {
    const amount = parseInt(qty) || 1;
    if (amount > 0) onAdjust(amount);
  };

  const handleRemove = () => {
    const amount = parseInt(qty) || 1;
    if (amount > 0 && amount <= newStock) onAdjust(-amount);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Current/New Stock Display */}
      <div className={cn(
        "flex items-center justify-center min-w-[80px] h-10 rounded-lg font-bold text-lg",
        hasChange && diff > 0 && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        hasChange && diff < 0 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        !hasChange && "bg-muted text-foreground"
      )}>
        {newStock}
        {hasChange && (
          <span className="text-xs ml-1 font-medium">
            ({diff > 0 ? `+${diff}` : diff})
          </span>
        )}
      </div>

      {/* Quick adjustment buttons */}
      <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
          onClick={handleRemove}
          disabled={newStock <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <Input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-12 h-8 text-center text-sm border-0 bg-background"
          min="1"
        />
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface StockItem {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  color: string | null;
  currentStock: number;
  newStock: number;
  sku: string | null;
  mainImage: string | null;
}

interface GroupedProduct {
  productId: string;
  productName: string;
  mainImage: string | null;
  categoryName: string | null;
  totalStock: number;
  variants: StockItem[];
  isExpanded: boolean;
}

export default function AdminStock() {
  const { data: products, isLoading } = useProducts({ status: 'all' });
  const { data: categories } = useCategories();
  const updateStock = useUpdateVariantStock();
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  
  // Stock editing
  const [stockChanges, setStockChanges] = useState<Record<string, number>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState<string>('');
  const [bulkOperation, setBulkOperation] = useState<'set' | 'add' | 'subtract'>('set');

  // Get all unique sizes and colors from variants
  const { allSizes, allColors } = useMemo(() => {
    if (!products) return { allSizes: [], allColors: [] };
    
    const sizes = new Set<string>();
    const colors = new Set<string>();
    
    products.forEach(p => {
      p.product_variants?.forEach(v => {
        if (v.size) sizes.add(v.size);
        if (v.color) colors.add(v.color);
      });
    });
    
    const sortedSizes = Array.from(sizes).sort((a, b) => {
      const indexA = SIZE_ORDER.indexOf(a);
      const indexB = SIZE_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return { allSizes: sortedSizes, allColors: Array.from(colors).sort() };
  }, [products]);

  // Build stock items from products
  const stockItems = useMemo((): StockItem[] => {
    if (!products) return [];
    
    const items: StockItem[] = [];
    
    products.forEach(product => {
      product.product_variants?.forEach(variant => {
        items.push({
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          currentStock: variant.stock_qty,
          newStock: stockChanges[variant.id] ?? variant.stock_qty,
          sku: variant.sku,
          mainImage: product.main_image_url,
        });
      });
    });
    
    return items;
  }, [products, stockChanges]);

  // Group and filter items
  const groupedProducts = useMemo((): GroupedProduct[] => {
    if (!products) return [];
    
    const groups: GroupedProduct[] = [];
    
    products.forEach(product => {
      // Filter by search
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) {
        return;
      }
      
      // Filter by category
      if (categoryFilter !== 'all' && product.category_id !== categoryFilter) {
        return;
      }
      
      let variants = product.product_variants || [];
      
      // Filter variants by size
      if (sizeFilter !== 'all') {
        variants = variants.filter(v => v.size === sizeFilter);
      }
      
      // Filter variants by color
      if (colorFilter !== 'all') {
        variants = variants.filter(v => v.color === colorFilter);
      }
      
      // Filter by stock status
      if (stockFilter === 'out-of-stock') {
        variants = variants.filter(v => v.stock_qty === 0);
      } else if (stockFilter === 'low-stock') {
        variants = variants.filter(v => v.stock_qty > 0 && v.stock_qty <= 3);
      } else if (stockFilter === 'in-stock') {
        variants = variants.filter(v => v.stock_qty > 0);
      }
      
      if (variants.length === 0) return;
      
      const sortedVariants = [...variants].sort((a, b) => {
        const indexA = SIZE_ORDER.indexOf(a.size);
        const indexB = SIZE_ORDER.indexOf(b.size);
        if (indexA !== indexB) {
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }
        return (a.color || '').localeCompare(b.color || '');
      });
      
      const category = categories?.find(c => c.id === product.category_id);
      
      groups.push({
        productId: product.id,
        productName: product.name,
        mainImage: product.main_image_url,
        categoryName: category?.name || null,
        totalStock: sortedVariants.reduce((sum, v) => sum + v.stock_qty, 0),
        variants: sortedVariants.map(v => ({
          variantId: v.id,
          productId: product.id,
          productName: product.name,
          size: v.size,
          color: v.color,
          currentStock: v.stock_qty,
          newStock: stockChanges[v.id] ?? v.stock_qty,
          sku: v.sku,
          mainImage: product.main_image_url,
        })),
        isExpanded: expandedProducts.has(product.id),
      });
    });
    
    return groups;
  }, [products, categories, search, categoryFilter, stockFilter, sizeFilter, colorFilter, stockChanges, expandedProducts]);

  // Count changes
  const changesCount = Object.keys(stockChanges).length;
  
  // Stats
  const stats = useMemo(() => {
    let totalVariants = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let totalUnits = 0;
    
    stockItems.forEach(item => {
      totalVariants++;
      totalUnits += item.currentStock;
      if (item.currentStock === 0) outOfStock++;
      else if (item.currentStock <= 3) lowStock++;
    });
    
    return { totalVariants, outOfStock, lowStock, totalUnits };
  }, [stockItems]);

  const handleStockChange = useCallback((variantId: string, value: number) => {
    const newValue = Math.max(0, value);
    const original = stockItems.find(i => i.variantId === variantId)?.currentStock;
    
    if (original === newValue) {
      setStockChanges(prev => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    } else {
      setStockChanges(prev => ({ ...prev, [variantId]: newValue }));
    }
  }, [stockItems]);

  const handleIncrement = useCallback((variantId: string, amount: number) => {
    const current = stockChanges[variantId] ?? stockItems.find(i => i.variantId === variantId)?.currentStock ?? 0;
    handleStockChange(variantId, current + amount);
  }, [stockChanges, stockItems, handleStockChange]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = new Set<string>();
      groupedProducts.forEach(g => g.variants.forEach(v => allIds.add(v.variantId)));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  }, [groupedProducts]);

  const handleSelectProduct = useCallback((productId: string, checked: boolean) => {
    const product = groupedProducts.find(g => g.productId === productId);
    if (!product) return;
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      product.variants.forEach(v => {
        if (checked) next.add(v.variantId);
        else next.delete(v.variantId);
      });
      return next;
    });
  }, [groupedProducts]);

  const handleSelectItem = useCallback((variantId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (checked) next.add(variantId);
      else next.delete(variantId);
      return next;
    });
  }, []);

  const handleBulkApply = useCallback(() => {
    const value = parseInt(bulkValue);
    if (isNaN(value)) {
      toast.error('Digite um valor numérico válido');
      return;
    }
    
    selectedItems.forEach(variantId => {
      const current = stockChanges[variantId] ?? stockItems.find(i => i.variantId === variantId)?.currentStock ?? 0;
      
      let newValue: number;
      if (bulkOperation === 'set') {
        newValue = value;
      } else if (bulkOperation === 'add') {
        newValue = current + value;
      } else {
        newValue = current - value;
      }
      
      handleStockChange(variantId, Math.max(0, newValue));
    });
    
    toast.success(`Estoque atualizado para ${selectedItems.size} itens`);
    setBulkValue('');
  }, [bulkValue, bulkOperation, selectedItems, stockChanges, stockItems, handleStockChange]);

  const handleSave = async () => {
    if (changesCount === 0) return;
    
    const updates = Object.entries(stockChanges).map(([id, stock_qty]) => ({
      id,
      stock_qty,
    }));
    
    try {
      await updateStock.mutateAsync(updates);
      setStockChanges({});
      setSelectedItems(new Set());
      toast.success(`${updates.length} variações atualizadas com sucesso!`);
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleReset = useCallback(() => {
    setStockChanges({});
    setSelectedItems(new Set());
  }, []);

  const toggleProductExpand = useCallback((productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedProducts(new Set(groupedProducts.map(g => g.productId)));
  }, [groupedProducts]);

  const collapseAll = useCallback(() => {
    setExpandedProducts(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('all');
    setStockFilter('all');
    setSizeFilter('all');
    setColorFilter('all');
  }, []);

  const hasActiveFilters = search || categoryFilter !== 'all' || stockFilter !== 'all' || sizeFilter !== 'all' || colorFilter !== 'all';

  return (
    <AdminGuard>
      <AdminLayout title="Gestão de Estoque">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Variações</p>
                <p className="text-2xl font-bold">{stats.totalVariants}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Unidades</p>
                <p className="text-2xl font-bold">{stats.totalUnits}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-2xl font-bold">{stats.lowStock}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sem Estoque</p>
                <p className="text-2xl font-bold">{stats.outOfStock}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories?.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo Estoque</SelectItem>
                <SelectItem value="in-stock">Com Estoque</SelectItem>
                <SelectItem value="low-stock">Estoque Baixo</SelectItem>
                <SelectItem value="out-of-stock">Sem Estoque</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tamanhos</SelectItem>
                {allSizes.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {allColors.length > 0 && (
              <Select value={colorFilter} onValueChange={setColorFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Cor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Cores</SelectItem>
                  {allColors.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">
                {selectedItems.size} {selectedItems.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              
              <div className="flex items-center gap-2">
                <Select value={bulkOperation} onValueChange={(v: 'set' | 'add' | 'subtract') => setBulkOperation(v)}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Definir como</SelectItem>
                    <SelectItem value="add">Adicionar</SelectItem>
                    <SelectItem value="subtract">Subtrair</SelectItem>
                  </SelectContent>
                </Select>
                
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-20 h-9"
                  min="0"
                />
                
                <Button size="sm" onClick={handleBulkApply} disabled={!bulkValue}>
                  Aplicar
                </Button>
              </div>
              
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                Limpar seleção
              </Button>
            </div>
          </div>
        )}

        {/* Save Bar */}
        {changesCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {changesCount} {changesCount === 1 ? 'alteração pendente' : 'alterações pendentes'}
              </span>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Descartar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateStock.isPending}>
                  {updateStock.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expandir Todos
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Recolher Todos
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {groupedProducts.length} produtos encontrados
          </p>
        </div>

        {/* Stock Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedItems.size > 0 && selectedItems.size === stockItems.filter(i => 
                        groupedProducts.some(g => g.variants.some(v => v.variantId === i.variantId))
                      ).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Produto / Variação</TableHead>
                  <TableHead className="w-64">Ajuste de Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedProducts.map(group => (
                  <>
                    {/* Product Row */}
                    <TableRow 
                      key={group.productId}
                      className="bg-muted/50 hover:bg-muted cursor-pointer"
                      onClick={() => toggleProductExpand(group.productId)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={group.variants.every(v => selectedItems.has(v.variantId))}
                          onCheckedChange={(checked) => handleSelectProduct(group.productId, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {group.isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {group.mainImage && (
                            <img 
                              src={group.mainImage} 
                              alt="" 
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{group.productName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {group.categoryName && (
                                <Badge variant="secondary" className="text-xs">
                                  {group.categoryName}
                                </Badge>
                              )}
                              <span>{group.variants.length} variações</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-semibold text-lg",
                          group.totalStock === 0 && "text-red-600",
                          group.totalStock > 0 && group.totalStock <= 3 && "text-yellow-600"
                        )}>
                          {group.totalStock} un
                        </span>
                      </TableCell>
                    </TableRow>
                    
                    {/* Variant Rows */}
                    {group.isExpanded && group.variants.map(variant => {
                      const hasChange = stockChanges[variant.variantId] !== undefined;
                      const diff = variant.newStock - variant.currentStock;
                      
                      return (
                        <TableRow 
                          key={variant.variantId}
                          className={cn(hasChange && "bg-yellow-50 dark:bg-yellow-900/10")}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(variant.variantId)}
                              onCheckedChange={(checked) => handleSelectItem(variant.variantId, !!checked)}
                            />
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="pl-10">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-medium">{variant.size}</Badge>
                              {variant.color && (
                                <Badge variant="secondary" className="text-xs">{variant.color}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StockAdjuster
                              currentStock={variant.currentStock}
                              newStock={variant.newStock}
                              hasChange={hasChange}
                              diff={diff}
                              onAdjust={(amount) => handleIncrement(variant.variantId, amount)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
