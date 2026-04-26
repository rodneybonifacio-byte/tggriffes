import { useState, useMemo, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, EyeOff, Eye, GripVertical, Save, RotateCcw, Search, Sparkles, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';
import { useHomeOrganizationProducts, useUpdateProductOrganization } from '@/hooks/useHomeOrganization';
import type { Product } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getProductImageUrl } from '@/lib/productImageUrl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type OrgProduct = Product & {
  is_featured: boolean;
  hidden_from_home: boolean;
  display_order: number | null;
};

interface SortableCardProps {
  product: OrgProduct;
  index: number;
  onToggleFeatured: (id: string) => void;
  onToggleHidden: (id: string) => void;
  isPreview?: boolean;
}

function SortableProductCard({ product, index, onToggleFeatured, onToggleHidden }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const totalStock = product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  const imageUrl = getProductImageUrl(product.main_image_url, product.shopify_image_url);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-card border rounded-lg overflow-hidden transition-all',
        product.hidden_from_home && 'opacity-50 grayscale',
        product.is_featured && 'ring-2 ring-primary shadow-lg',
        isDragging && 'shadow-2xl'
      )}
    >
      {/* Position badge */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur font-mono text-xs">
          #{index + 1}
        </Badge>
        {product.is_featured && (
          <Badge className="bg-primary text-primary-foreground gap-1">
            <Sparkles className="h-3 w-3" />
            Destaque
          </Badge>
        )}
        {product.hidden_from_home && (
          <Badge variant="destructive" className="gap-1">
            <EyeOff className="h-3 w-3" />
            Oculto
          </Badge>
        )}
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/90 backdrop-blur cursor-grab active:cursor-grabbing hover:bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Image */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2 leading-tight">{product.name}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Estoque: {totalStock}</span>
          <span className="font-mono">R$ {(product.price_cents / 100).toFixed(2)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-1 border-t">
          <Button
            size="sm"
            variant={product.is_featured ? 'default' : 'outline'}
            className="flex-1 h-8 text-xs gap-1"
            onClick={() => onToggleFeatured(product.id)}
          >
            <Star className={cn('h-3 w-3', product.is_featured && 'fill-current')} />
            {product.is_featured ? 'Destaque' : 'Destacar'}
          </Button>
          <Button
            size="sm"
            variant={product.hidden_from_home ? 'destructive' : 'outline'}
            className="h-8 px-2"
            onClick={() => onToggleHidden(product.id)}
            title={product.hidden_from_home ? 'Mostrar na home' : 'Ocultar da home'}
          >
            {product.hidden_from_home ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ product, index }: { product: OrgProduct; index: number }) {
  const imageUrl = getProductImageUrl(product.main_image_url, product.shopify_image_url);
  return (
    <div className="relative bg-card border rounded-lg overflow-hidden">
      <div className="absolute top-1 left-1 z-10">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur font-mono text-[10px] h-5">
          #{index + 1}
        </Badge>
      </div>
      {product.is_featured && (
        <div className="absolute top-1 right-1 z-10">
          <Badge className="bg-primary text-primary-foreground gap-0.5 text-[10px] h-5 px-1.5">
            <Sparkles className="h-2.5 w-2.5" />
          </Badge>
        </div>
      )}
      <div className="aspect-square bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs line-clamp-2 leading-tight">{product.name}</p>
      </div>
    </div>
  );
}

function AdminHomeOrganizationContent() {
  const { data: products = [], isLoading } = useHomeOrganizationProducts();
  const updateMutation = useUpdateProductOrganization();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'featured' | 'hidden' | 'visible'>('all');
  const [showPreview, setShowPreview] = useState(true);
  const [localProducts, setLocalProducts] = useState<OrgProduct[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize local state when data loads
  useEffect(() => {
    if (products.length === 0) return;
    const sorted = [...products].sort((a, b) => {
      const ao = (a as any).display_order;
      const bo = (b as any).display_order;
      const aHas = ao !== null && ao !== undefined;
      const bHas = bo !== null && bo !== undefined;
      if (aHas && bHas) return ao - bo;
      if (aHas) return -1;
      if (bHas) return 1;
      // Featured then by name
      const af = (a as any).is_featured ? 1 : 0;
      const bf = (b as any).is_featured ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name, 'pt-BR');
    }) as OrgProduct[];
    setLocalProducts(sorted);
    setIsDirty(false);
  }, [products]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filtered view (drag works on the filtered subset, but we reorder the full list)
  const visibleProducts = useMemo(() => {
    return localProducts.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'featured' && !p.is_featured) return false;
      if (filter === 'hidden' && !p.hidden_from_home) return false;
      if (filter === 'visible' && p.hidden_from_home) return false;
      return true;
    });
  }, [localProducts, search, filter]);

  // Preview list (what the home will look like)
  const previewProducts = useMemo(() => {
    return localProducts.filter(p => !p.hidden_from_home);
  }, [localProducts]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalProducts(items => {
      const oldIndex = items.findIndex(p => p.id === active.id);
      const newIndex = items.findIndex(p => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
    setIsDirty(true);
  };

  const handleToggleFeatured = (id: string) => {
    setLocalProducts(items =>
      items.map(p => (p.id === id ? { ...p, is_featured: !p.is_featured } : p))
    );
    setIsDirty(true);
  };

  const handleToggleHidden = (id: string) => {
    setLocalProducts(items =>
      items.map(p => (p.id === id ? { ...p, hidden_from_home: !p.hidden_from_home } : p))
    );
    setIsDirty(true);
  };

  const handleSave = async () => {
    const updates = localProducts.map((p, idx) => ({
      id: p.id,
      display_order: idx,
      is_featured: p.is_featured,
      hidden_from_home: p.hidden_from_home,
    }));
    try {
      await updateMutation.mutateAsync(updates);
      toast.success('Organização da home salva!', {
        description: `${updates.length} produtos atualizados.`,
      });
      setIsDirty(false);
    } catch (e) {
      toast.error('Erro ao salvar organização');
    }
  };

  const handleReset = () => {
    if (!confirm('Limpar toda a organização manual? Os produtos voltarão à ordem automática.')) return;
    const updates = localProducts.map(p => ({
      id: p.id,
      display_order: null,
      is_featured: false,
      hidden_from_home: false,
    }));
    updateMutation.mutateAsync(updates).then(() => {
      toast.success('Organização resetada para o padrão');
    });
  };

  const featuredCount = localProducts.filter(p => p.is_featured).length;
  const hiddenCount = localProducts.filter(p => p.hidden_from_home).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{localProducts.length}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3" /> Destaques
          </p>
          <p className="text-2xl font-bold">{featuredCount}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/20">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Eye className="h-3 w-3" /> Visíveis
          </p>
          <p className="text-2xl font-bold">{localProducts.length - hiddenCount}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <EyeOff className="h-3 w-3" /> Ocultos
          </p>
          <p className="text-2xl font-bold">{hiddenCount}</p>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="p-4 sticky top-0 lg:top-4 z-30 backdrop-blur bg-background/95">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="featured" className="gap-1">
                <Star className="h-3 w-3" /> Destaques
              </TabsTrigger>
              <TabsTrigger value="visible">Visíveis</TabsTrigger>
              <TabsTrigger value="hidden">Ocultos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 px-3 border rounded-md h-10">
            <Switch id="preview-toggle" checked={showPreview} onCheckedChange={setShowPreview} />
            <label htmlFor="preview-toggle" className="text-sm cursor-pointer whitespace-nowrap">
              Preview
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={updateMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" /> Resetar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className={cn(isDirty && 'animate-pulse')}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar Ordem
            </Button>
          </div>
        </div>
        {isDirty && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Você tem alterações não salvas
          </p>
        )}
      </Card>

      {/* Main grid + preview */}
      <div className={cn('grid gap-6', showPreview ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1')}>
        {/* Sortable grid */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Arraste pelo canto superior direito de cada card para reordenar.
            {visibleProducts.length !== localProducts.length && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                Mostrando {visibleProducts.length} de {localProducts.length}
              </span>
            )}
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleProducts.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {visibleProducts.map((product) => {
                  const realIndex = localProducts.findIndex(p => p.id === product.id);
                  return (
                    <SortableProductCard
                      key={product.id}
                      product={product}
                      index={realIndex}
                      onToggleFeatured={handleToggleFeatured}
                      onToggleHidden={handleToggleHidden}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {visibleProducts.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhum produto encontrado com esses filtros.
            </Card>
          )}
        </div>

        {/* Live preview */}
        {showPreview && (
          <aside className="lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-10rem)]">
            <Card className="overflow-hidden">
              <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Eye className="h-4 w-4" /> Preview da Home
                  </p>
                  <p className="text-xs text-muted-foreground">{previewProducts.length} produtos visíveis</p>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              <ScrollArea className="h-[60vh] lg:h-[calc(100vh-14rem)]">
                <div className="p-3 grid grid-cols-2 gap-2">
                  {previewProducts.map((p, i) => (
                    <PreviewCard key={p.id} product={p} index={i} />
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function AdminHomeOrganization() {
  return (
    <AdminGuard>
      <AdminLayout title="Organizar Home" backHref="/admin">
        <AdminHomeOrganizationContent />
      </AdminLayout>
    </AdminGuard>
  );
}