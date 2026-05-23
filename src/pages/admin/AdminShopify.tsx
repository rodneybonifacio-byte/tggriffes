import { useState, useEffect, useCallback } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Package, 
  Boxes, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Store,
  Trash2,
  Wrench,
  Play,
  Pause,
  ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useShopifySyncLogs,
  useShopifyProductMappings,
  useSyncAllProducts,
  useSyncPendingProducts,
  useSyncInventory,
  useCleanupOrphans,
  useSyncBatch,
  BatchSyncResult,
  useArchiveShopifyBatch,
  useReplicateWithStockBatch,
} from '@/hooks/useShopifySync';
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
import { useProducts } from '@/hooks/useProducts';
import { useMissingMappingProducts, useFixMissingMappings } from '@/hooks/useShopifyMissingMappings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AdminShopify() {
  const { data: syncLogs, isLoading: logsLoading, refetch: refetchLogs } = useShopifySyncLogs();
  const { data: mappings, isLoading: mappingsLoading, refetch: refetchMappings } = useShopifyProductMappings();
  const { data: products, refetch: refetchProducts } = useProducts({ status: 'active' });
  
  const syncAllProducts = useSyncAllProducts();
  const syncPendingProducts = useSyncPendingProducts();
  const syncInventory = useSyncInventory();
  const cleanupOrphans = useCleanupOrphans();
  const syncBatch = useSyncBatch();
  const archiveShopifyBatch = useArchiveShopifyBatch();
  const replicateWithStockBatch = useReplicateWithStockBatch();

  // Full replication state (archive-all-then-replicate-with-stock)
  const [replicationState, setReplicationState] = useState<{
    isRunning: boolean;
    phase: 'idle' | 'archiving' | 'replicating' | 'done';
    archived: number;
    replicated: number;
    errors: any[];
    log: string[];
  }>({ isRunning: false, phase: 'idle', archived: 0, replicated: 0, errors: [], log: [] });

  const runFullReplication = useCallback(async () => {
    setReplicationState({ isRunning: true, phase: 'archiving', archived: 0, replicated: 0, errors: [], log: ['Iniciando arquivamento no Shopify...'] });
    const errors: any[] = [];
    let archived = 0;

    try {
      // Phase 1: archive ALL non-archived Shopify products (active then draft)
      for (const status of ['active', 'draft'] as const) {
        let hasMore = true;
        let safety = 0;
        while (hasMore && safety < 200) {
          safety++;
          const res = await archiveShopifyBatch.mutateAsync({ status, limit: 30 });
          archived += res.archived;
          errors.push(...(res.errors || []));
          hasMore = res.hasMore;
          setReplicationState(prev => ({
            ...prev,
            archived,
            errors: [...errors],
            log: [...prev.log, `Arquivados ${res.archived} (${status}). Restam mais? ${hasMore ? 'sim' : 'não'}`],
          }));
        }
      }

      // Phase 2: replicate active products with stock
      setReplicationState(prev => ({ ...prev, phase: 'replicating', log: [...prev.log, 'Replicando produtos ativos com estoque...'] }));
      let hasMore = true;
      let safety = 0;
      let replicated = 0;
      while (hasMore && safety < 200) {
        safety++;
        const res = await replicateWithStockBatch.mutateAsync({ limit: 10 });
        replicated += res.processed;
        errors.push(...(res.errors || []));
        hasMore = res.hasMore;
        setReplicationState(prev => ({
          ...prev,
          replicated,
          errors: [...errors],
          log: [...prev.log, `Replicados ${res.processed}. Restantes: ${res.remainingCount}`],
        }));
      }

      setReplicationState(prev => ({ ...prev, isRunning: false, phase: 'done', log: [...prev.log, 'Concluído.'] }));
      refetchMappings();
      refetchProducts();
      refetchLogs();
      toast.success(`Replicação concluída: ${archived} arquivados, ${replicated} replicados.`);
    } catch (err: any) {
      setReplicationState(prev => ({ ...prev, isRunning: false, phase: 'done', errors: [...prev.errors, { error: err.message }], log: [...prev.log, `Erro: ${err.message}`] }));
      toast.error(`Erro na replicação: ${err.message}`);
    }
  }, [archiveShopifyBatch, replicateWithStockBatch, refetchMappings, refetchProducts, refetchLogs]);

  const runReplicationOnly = useCallback(async () => {
    setReplicationState({ isRunning: true, phase: 'replicating', archived: 0, replicated: 0, errors: [], log: ['Replicando produtos ativos com estoque (sem arquivar)...'] });
    const errors: any[] = [];
    let replicated = 0;
    try {
      let hasMore = true;
      let safety = 0;
      while (hasMore && safety < 200) {
        safety++;
        const res = await replicateWithStockBatch.mutateAsync({ limit: 10 });
        replicated += res.processed;
        errors.push(...(res.errors || []));
        hasMore = res.hasMore;
        setReplicationState(prev => ({
          ...prev,
          replicated,
          errors: [...errors],
          log: [...prev.log, `Replicados ${res.processed}. Restantes: ${res.remainingCount}`],
        }));
      }
      setReplicationState(prev => ({ ...prev, isRunning: false, phase: 'done', log: [...prev.log, 'Concluído.'] }));
      refetchMappings();
      refetchProducts();
      refetchLogs();
      toast.success(`Replicação concluída: ${replicated} produtos criados no Shopify.`);
    } catch (err: any) {
      setReplicationState(prev => ({ ...prev, isRunning: false, phase: 'done', errors: [...prev.errors, { error: err.message }], log: [...prev.log, `Erro: ${err.message}`] }));
      toast.error(`Erro na replicação: ${err.message}`);
    }
  }, [replicateWithStockBatch, refetchMappings, refetchProducts, refetchLogs]);

  // Batch sync state
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    current: number;
    total: number;
    processed: number;
    errors: any[];
    onlyMissingImages: boolean;
  }>({ isRunning: false, isPaused: false, current: 0, total: 0, processed: 0, errors: [], onlyMissingImages: true });

  // Count products missing shopify_image_url
  const [missingImageCount, setMissingImageCount] = useState<number>(0);
  const [activeProductsCount, setActiveProductsCount] = useState<number>(0);

  useEffect(() => {
    async function fetchCounts() {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .is('shopify_image_url', null);
      setMissingImageCount(count || 0);
      const { count: activeCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      setActiveProductsCount(activeCount || 0);
    }
    fetchCounts();
  }, [products]);

  // Batch sync runner
  const runBatchSync = useCallback(async () => {
    if (batchProgress.isPaused) return;
    
    try {
      const result = await syncBatch.mutateAsync({ 
        offset: batchProgress.current, 
        limit: 25,
        onlyMissingImages: batchProgress.onlyMissingImages,
      });
      
      setBatchProgress(prev => ({
        ...prev,
        current: result.nextOffset || prev.current + result.processed,
        total: result.totalPending + prev.processed,
        processed: prev.processed + result.processed,
        errors: [...prev.errors, ...result.errors],
      }));

      // Refresh counts
      setMissingImageCount(result.remainingCount);
      refetchMappings();
      refetchProducts();

      if (result.hasMore && !batchProgress.isPaused) {
        // Schedule next batch after a short delay
        setTimeout(() => runBatchSync(), 1000);
      } else {
        // Finished
        setBatchProgress(prev => ({ ...prev, isRunning: false }));
        if (result.hasMore) {
          toast.info(`Sincronização pausada. ${result.remainingCount} produtos restantes.`);
        } else {
          toast.success(`Sincronização concluída! ${batchProgress.processed + result.processed} produtos processados.`);
        }
        refetchLogs();
      }
    } catch (error: any) {
      setBatchProgress(prev => ({ ...prev, isRunning: false }));
      toast.error(`Erro no lote: ${error.message}`);
    }
  }, [batchProgress.current, batchProgress.isPaused, batchProgress.processed, syncBatch, refetchMappings, refetchProducts, refetchLogs]);

  const startBatchSync = (onlyMissingImages: boolean = true) => {
    setBatchProgress({
      isRunning: true,
      isPaused: false,
      current: 0,
      total: onlyMissingImages ? missingImageCount : activeProductsCount,
      processed: 0,
      errors: [],
      onlyMissingImages,
    });
  };

  const pauseBatchSync = () => {
    setBatchProgress(prev => ({ ...prev, isPaused: true, isRunning: false }));
    toast.info('Sincronização pausada. Clique em "Continuar" para retomar.');
  };

  const resumeBatchSync = () => {
    setBatchProgress(prev => ({ ...prev, isPaused: false, isRunning: true }));
  };

  const resetBatchSync = () => {
    setBatchProgress({ isRunning: false, isPaused: false, current: 0, total: 0, processed: 0, errors: [], onlyMissingImages: true });
  };

  // Effect to run batch when started/resumed
  useEffect(() => {
    if (batchProgress.isRunning && !batchProgress.isPaused) {
      runBatchSync();
    }
  }, [batchProgress.isRunning, batchProgress.isPaused]);

  // Missing mappings
  const { data: missingMappingProducts } = useMissingMappingProducts();
  const { fixMappings, continueProcessing: continueFixMappings, progress: fixProgress, reset: resetFixProgress } = useFixMissingMappings();

  const syncedProductIds = new Set(mappings?.map(m => m.product_id) || []);
  const activeProductIds = new Set(products?.map(p => p.id) || []);
  const unsyncedProducts = products?.filter(p => !syncedProductIds.has(p.id)) || [];
  
  // Count orphaned mappings (synced to Shopify but not active locally)
  const orphanedMappings = mappings?.filter(m => !activeProductIds.has(m.product_id)) || [];

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
      case 'delete':
        return <Badge variant="outline" className="text-red-600"><Trash2 className="w-3 h-3 mr-1" /> Remoção</Badge>;
      case 'cleanup':
        return <Badge variant="outline" className="text-orange-600"><Trash2 className="w-3 h-3 mr-1" /> Limpeza</Badge>;
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
            
            <div className="flex gap-2 flex-wrap">
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
              
              {unsyncedProducts.length > 0 && (
                <Button
                  variant="outline"
                  className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={() => syncPendingProducts.mutate()}
                  disabled={syncPendingProducts.isPending}
                >
                  {syncPendingProducts.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Sincronizar Pendentes ({unsyncedProducts.length})
                </Button>
              )}

              {orphanedMappings.length > 0 && (
                <Button
                  variant="outline"
                  className="border-red-500 text-red-700 hover:bg-red-50"
                  onClick={() => cleanupOrphans.mutate()}
                  disabled={cleanupOrphans.isPending}
                >
                  {cleanupOrphans.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Limpar Órfãos ({orphanedMappings.length})
                </Button>
              )}

              {/* Fix Missing Mappings Button */}
              {(missingMappingProducts?.length ?? 0) > 0 && !fixProgress.isRunning && !fixProgress.isPaused && (
                <Button
                  variant="outline"
                  className="border-purple-500 text-purple-700 hover:bg-purple-50"
                  onClick={() => fixMappings(missingMappingProducts || [])}
                  disabled={fixProgress.isRunning}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Corrigir Mapeamentos ({missingMappingProducts?.length})
                </Button>
              )}
              
              <Button
                onClick={() => startBatchSync(false)}
                disabled={batchProgress.isRunning || batchProgress.isPaused}
              >
                {batchProgress.isRunning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Tudo
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={replicationState.isRunning || batchProgress.isRunning}
                  >
                    {replicationState.isRunning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Arquivar Shopify + Replicar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arquivar tudo no Shopify e replicar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação vai <strong>arquivar todos os produtos no Shopify</strong> (não exclui — ficam como "archived" e podem ser restaurados manualmente),
                      apagar os mapeamentos locais e em seguida <strong>replicar apenas produtos ativos com estoque &gt; 0</strong> do banco para o Shopify.
                      <br /><br />
                      Pode demorar alguns minutos. Não feche esta página enquanto estiver rodando.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={runFullReplication}>Sim, arquivar e replicar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="default"
                onClick={runReplicationOnly}
                disabled={replicationState.isRunning || batchProgress.isRunning}
              >
                {replicationState.isRunning && replicationState.phase === 'replicating' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Replicar Ativos com Estoque
              </Button>
            </div>
          </div>

          {(replicationState.isRunning || replicationState.phase === 'done') && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Arquivar Shopify + Replicar Ativos com Estoque
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Fase: <strong>{replicationState.phase}</strong></div>
                <div>Arquivados no Shopify: <strong>{replicationState.archived}</strong></div>
                <div>Replicados (criados): <strong>{replicationState.replicated}</strong></div>
                {replicationState.errors.length > 0 && (
                  <div className="text-red-600">❌ {replicationState.errors.length} erro(s)</div>
                )}
                <details className="text-xs text-muted-foreground">
                  <summary>Log</summary>
                  <ul className="mt-1 space-y-0.5">
                    {replicationState.log.slice(-30).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Batch Sync Progress Card - NEW */}
          {(batchProgress.isRunning || batchProgress.isPaused || batchProgress.processed > 0) && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Sincronização em Blocos (Imagens Shopify CDN)
                  </CardTitle>
                  <div className="flex gap-2">
                    {batchProgress.isRunning ? (
                      <Button variant="outline" size="sm" onClick={pauseBatchSync}>
                        <Pause className="w-4 h-4 mr-1" />
                        Pausar
                      </Button>
                    ) : batchProgress.isPaused ? (
                      <Button variant="outline" size="sm" onClick={resumeBatchSync}>
                        <Play className="w-4 h-4 mr-1" />
                        Continuar
                      </Button>
                    ) : null}
                    {!batchProgress.isRunning && batchProgress.processed > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetBatchSync}>
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>
                    {batchProgress.isRunning ? 'Processando...' : batchProgress.isPaused ? 'Pausado' : 'Concluído'}
                  </span>
                  <span>
                    {batchProgress.processed} processados 
                    {missingImageCount > 0 && ` • ${missingImageCount} restantes`}
                  </span>
                </div>
                <Progress 
                  value={batchProgress.total > 0 ? (batchProgress.processed / batchProgress.total) * 100 : 0} 
                  className="h-2" 
                />
                
                {batchProgress.errors.length > 0 && (
                  <div className="text-sm text-red-600">
                    ❌ {batchProgress.errors.length} erro(s)
                  </div>
                )}
                
                {syncBatch.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sincronizando lote...
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fix Progress Card */}
          {(fixProgress.isRunning || fixProgress.isPaused || fixProgress.results.length > 0) && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Correção de Mapeamentos (Lote {fixProgress.currentBatch}/{fixProgress.totalBatches})
                  </CardTitle>
                  <div className="flex gap-2">
                    {fixProgress.isRunning && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </div>
                    )}
                    {fixProgress.isPaused && (
                      <Button variant="outline" size="sm" onClick={continueFixMappings}>
                        <Play className="w-4 h-4 mr-1" />
                        Continuar
                      </Button>
                    )}
                    {!fixProgress.isRunning && !fixProgress.isPaused && fixProgress.results.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFixProgress}>
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>
                    {fixProgress.isRunning 
                      ? `Processando: ${fixProgress.currentProduct}` 
                      : fixProgress.isPaused 
                        ? 'Pausado - aguardando continuar próximo lote'
                        : 'Concluído'}
                  </span>
                  <span>{fixProgress.current} / {fixProgress.total}</span>
                </div>
                <Progress value={(fixProgress.current / fixProgress.total) * 100} className="h-2" />
                
                {fixProgress.results.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {fixProgress.results.slice(-10).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {r.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className={r.success ? 'text-green-800' : 'text-red-800'}>
                          {r.productName}
                          {r.error && <span className="text-xs ml-2">({r.error})</span>}
                        </span>
                      </div>
                    ))}
                    {fixProgress.results.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ... e mais {fixProgress.results.length - 10} itens
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm font-medium pt-2 border-t">
                  ✅ {fixProgress.results.filter(r => r.success).length} sucesso 
                  {fixProgress.results.filter(r => !r.success).length > 0 && (
                    <span className="text-red-600 ml-2">
                      ❌ {fixProgress.results.filter(r => !r.success).length} erro
                    </span>
                  )}
                  {fixProgress.isPaused && (
                    <span className="text-purple-600 ml-2">
                      • {fixProgress.total - fixProgress.current} restantes
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {/* NEW: Missing Images Card with Batch Sync Button */}
            <Card className={missingImageCount > 0 ? 'border-blue-300 bg-blue-50/30' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Imagens Faltando
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {missingImageCount}
                </div>
                {missingImageCount > 0 && !batchProgress.isRunning && !batchProgress.isPaused && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2 w-full border-blue-400 text-blue-700 hover:bg-blue-100"
                    onClick={() => startBatchSync(true)}
                    disabled={syncBatch.isPending}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Sync em Blocos
                  </Button>
                )}
              </CardContent>
            </Card>

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
                  Mapeamentos Faltantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {missingMappingProducts?.length || 0}
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
                  Órfãos no Shopify
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {orphanedMappings.length}
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
