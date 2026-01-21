import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { StockModal } from '@/components/admin/StockModal';
import { useProducts, useDeleteProduct, useToggleProductActive, Product } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useProducts';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Search, 
  Package, 
  Pencil, 
  Boxes, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const AdminProducts = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: products = [], isLoading } = useProducts({
    search,
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter as 'active' | 'inactive' : 'all',
    stock: stockFilter !== 'all' ? stockFilter as 'in-stock' | 'out-of-stock' | 'low-stock' : 'all',
  });
  const { mutateAsync: deleteProduct, isPending: isDeleting } = useDeleteProduct();
  const { mutateAsync: toggleProductActive, isPending: isToggling } = useToggleProductActive();
  const { toast } = useToast();
  const { canViewPrices, canEditProducts, canDeleteProducts, canEditStock } = usePermissions();

  const handleToggleActive = async (product: Product) => {
    try {
      await toggleProductActive({ id: product.id, active: !product.active });
      toast({
        title: product.active ? 'Produto desativado' : 'Produto ativado',
        description: `${product.name} foi ${product.active ? 'desativado' : 'ativado'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do produto.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await deleteProduct(product.id);
      toast({
        title: 'Produto excluído',
        description: `${product.name} foi removido com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o produto.',
        variant: 'destructive',
      });
    }
  };

  const getTotalStock = (product: Product) => {
    return product.product_variants?.reduce((sum, v) => sum + v.stock_qty, 0) || 0;
  };

  return (
    <AdminGuard>
      <AdminLayout title="Produtos">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {canEditProducts && (
            <Link to="/admin/produtos/novo">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estoque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in-stock">Com estoque</SelectItem>
              <SelectItem value="low-stock">Estoque baixo</SelectItem>
              <SelectItem value="out-of-stock">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum produto encontrado</p>
            <p className="text-muted-foreground mb-4">Comece cadastrando seu primeiro produto</p>
            {canEditProducts && (
              <Link to="/admin/produtos/novo">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    {canViewPrices && <TableHead className="text-right">Preço</TableHead>}
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const totalStock = getTotalStock(product);
                    const isLowStock = totalStock > 0 && totalStock <= 3;
                    const isOutOfStock = totalStock === 0;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.main_image_url ? (
                            <img 
                              src={product.main_image_url} 
                              alt={product.name}
                              className="h-12 w-12 rounded object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-secondary flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.categories?.name || '-'}</TableCell>
                        {canViewPrices && (
                          <TableCell className="text-right">{formatPrice(product.price_cents)}</TableCell>
                        )}
                        <TableCell className="text-center">
                          <span className={
                            isOutOfStock ? 'text-destructive' :
                            isLowStock ? 'text-warning' : ''
                          }>
                            {totalStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.active ? 'default' : 'secondary'}>
                            {product.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditProducts && (
                              <Link to={`/admin/produtos/${product.id}`}>
                                <Button variant="ghost" size="icon" title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {canEditStock && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Estoque rápido"
                                onClick={() => setStockModalProduct(product)}
                              >
                                <Boxes className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditProducts && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title={product.active ? 'Desativar' : 'Ativar'}
                                onClick={() => handleToggleActive(product)}
                                disabled={isToggling}
                              >
                                {product.active ? (
                                  <ToggleRight className="h-4 w-4" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {canDeleteProducts && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    title="Excluir"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir "{product.name}"? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteProduct(product)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {products.map((product) => {
                const totalStock = getTotalStock(product);
                const isLowStock = totalStock > 0 && totalStock <= 3;
                const isOutOfStock = totalStock === 0;

                return (
                  <Card key={product.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {product.main_image_url ? (
                          <img 
                            src={product.main_image_url} 
                            alt={product.name}
                            className="h-20 w-20 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium truncate">{product.name}</h3>
                            <Badge variant={product.active ? 'default' : 'secondary'} className="flex-shrink-0">
                              {product.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {product.categories?.name || 'Sem categoria'}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            {canViewPrices && (
                              <span className="font-semibold">{formatPrice(product.price_cents)}</span>
                            )}
                            <span className={`text-sm ${
                              isOutOfStock ? 'text-destructive' :
                              isLowStock ? 'text-warning' : 'text-muted-foreground'
                            }`}>
                              {totalStock} un.
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {canEditProducts && (
                          <Link to={`/admin/produtos/${product.id}`} className="flex-1">
                            <Button variant="outline" className="w-full" size="sm">
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </Link>
                        )}
                        {canEditStock && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setStockModalProduct(product)}
                          >
                            <Boxes className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteProducts && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{product.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProduct(product)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Stock Modal */}
        <StockModal
          product={stockModalProduct}
          open={!!stockModalProduct}
          onClose={() => setStockModalProduct(null)}
        />
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminProducts;
