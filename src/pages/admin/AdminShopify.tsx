import { useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Package, 
  Boxes, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Store
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useShopifySyncLogs,
  useShopifyProductMappings,
  useSyncAllProducts,
  useSyncInventory,
} from '@/hooks/useShopifySync';
import { useProducts } from '@/hooks/useProducts';

export default function AdminShopify() {
  const { data: syncLogs, isLoading: logsLoading } = useShopifySyncLogs();
  const { data: mappings, isLoading: mappingsLoading } = useShopifyProductMappings();
  const { data: products } = useProducts({ status: 'active' });
  
  const syncAllProducts = useSyncAllProducts();
  const syncInventory = useSyncInventory();

  const syncedProductIds = new Set(mappings?.map(m => m.product_id) || []);
  const unsyncedProducts = products?.filter(p => !syncedProductIds.has(p.id)) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      case 'partial':
        return <Badge className="bg-amber-100 text-amber-800"><AlertCircle className="w-3 h-3 mr-1" /> Parcial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSyncTypeBadge = (type: string) => {
    switch (type) {
      case 'sync_all':
        return <Badge variant="outline"><Package className="w-3 h-3 mr-1" /> Produtos</Badge>;
      case 'sync_inventory':
      case 'inventory':
        return <Badge variant="outline"><Boxes className="w-3 h-3 mr-1" /> Estoque</Badge>;
      case 'sync_product':
        return <Badge variant="outline"><Package className="w-3 h-3 mr-1" /> Produto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const shopifyDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || '5c91cd-6e.myshopify.com';

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Store className="w-6 h-6" />
                Integração Shopify
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Sincronize produtos e estoque com sua loja Shopify
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => syncInventory.mutate()}
                disabled={syncInventory.isPending}
              >
                {syncInventory.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Boxes className="w-4 h-4 mr-2" />
                )}
                Sincronizar Estoque
              </Button>
              
              <Button
                onClick={() => syncAllProducts.mutate()}
                disabled={syncAllProducts.isPending}
              >
                {syncAllProducts.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Tudo
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Produtos Sincronizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mappings?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pendentes de Sincronização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {unsyncedProducts.length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {products?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Última Sincronização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">
                  {syncLogs?.[0] ? format(new Date(syncLogs[0].created_at), "dd/MM HH:mm", { locale: ptBR }) : 'Nunca'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="mappings" className="space-y-4">
            <TabsList>
              <TabsTrigger value="mappings">Produtos Mapeados</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({unsyncedProducts.length})</TabsTrigger>
              <TabsTrigger value="logs">Histórico de Sync</TabsTrigger>
            </TabsList>

            {/* Mapped Products */}
            <TabsContent value="mappings">
              <Card>
                <CardHeader>
                  <CardTitle>Produtos Sincronizados</CardTitle>
                  <CardDescription>
                    Produtos que já existem no Shopify
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mappingsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto Local</TableHead>
                          <TableHead>ID Shopify</TableHead>
                          <TableHead>Handle</TableHead>
                          <TableHead>Última Sync</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappings?.map((mapping) => {
                          const product = products?.find(p => p.id === mapping.product_id);
                          return (
                            <TableRow key={mapping.id}>
                              <TableCell className="font-medium">
                                {product?.name || 'Produto removido'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {mapping.shopify_product_id}
                              </TableCell>
                              <TableCell>
                                {mapping.shopify_product_handle}
                              </TableCell>
                              <TableCell>
                                {format(new Date(mapping.last_synced_at), "dd/MM HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={`https://${shopifyDomain}/admin/products/${mapping.shopify_product_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Ver no Shopify
                                  </a>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!mappings || mappings.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhum produto sincronizado ainda. Clique em "Sincronizar Tudo" para começar.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pending Products */}
            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Produtos Pendentes</CardTitle>
                  <CardDescription>
                    Produtos que ainda não foram enviados para o Shopify
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Variantes</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unsyncedProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>
                            {product.categories?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {product.product_variants?.length || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-50">
                              Pendente
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {unsyncedProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            Todos os produtos estão sincronizados!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sync Logs */}
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Sincronizações</CardTitle>
                  <CardDescription>
                    Últimas 50 operações de sincronização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Produtos</TableHead>
                          <TableHead>Variantes</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncLogs?.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {getSyncTypeBadge(log.sync_type)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(log.status)}
                            </TableCell>
                            <TableCell>{log.products_synced}</TableCell>
                            <TableCell>{log.variants_synced}</TableCell>
                            <TableCell>
                              {log.errors ? (
                                <span className="text-red-600 text-sm">
                                  {Array.isArray(log.errors) ? log.errors.length : 1} erro(s)
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!syncLogs || syncLogs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma sincronização realizada ainda.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
