import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { compressImage, generateThumbnail } from '@/lib/imageCompression';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  sizeKB: number;
  type: string;
}

interface ProcessResult {
  file: string;
  originalKB: number;
  newKB: number;
  reduction: string;
  status: 'success' | 'error' | 'skipped';
}

export default function AdminImageOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    totalFiles: number;
    totalSizeKB: number;
    largeFilesCount: number;
    largeFilesSizeKB: number;
  } | null>(null);
  const { toast } = useToast();

  const loadFiles = async () => {
    setIsLoading(true);
    setFiles([]);
    setResults([]);
    setProgress(0);

    try {
      let allFiles: FileInfo[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await supabase.functions.invoke('recompress-images', {
          body: { offset },
        });

        if (response.error) throw response.error;

        const data = response.data;
        allFiles = [...allFiles, ...data.files];
        hasMore = data.hasMore;
        offset = data.nextOffset;
      }

      // Filter only large files (> 100KB)
      const largeFiles = allFiles.filter(f => f.sizeKB > 100);
      
      setFiles(largeFiles);
      setStats({
        totalFiles: allFiles.length,
        totalSizeKB: allFiles.reduce((sum, f) => sum + f.sizeKB, 0),
        largeFilesCount: largeFiles.length,
        largeFilesSizeKB: largeFiles.reduce((sum, f) => sum + f.sizeKB, 0),
      });

      toast({
        title: 'Análise concluída',
        description: `${largeFiles.length} imagens grandes encontradas (>${100}KB)`,
      });
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: 'Erro ao carregar arquivos',
        description: 'Não foi possível listar as imagens.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processImages = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    const newResults: ProcessResult[] = [];
    let totalSaved = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 1) / files.length) * 100));

      try {
        // Download the image
        const { data: imageBlob, error: downloadError } = await supabase.storage
          .from('product-images')
          .download(file.path);

        if (downloadError || !imageBlob) {
          newResults.push({
            file: file.name,
            originalKB: file.sizeKB,
            newKB: file.sizeKB,
            reduction: '0%',
            status: 'error',
          });
          continue;
        }

        // Convert Blob to File for compression
        const imageFile = new File([imageBlob], file.name, { type: imageBlob.type });

        // Compress original and generate thumbnail in parallel
        const [compressedFile, thumbnailFile] = await Promise.all([
          compressImage(imageFile),
          generateThumbnail(imageFile),
        ]);
        const newSizeKB = Math.round(compressedFile.size / 1024);

        // Only upload if we saved at least 10%
        if (compressedFile.size < imageBlob.size * 0.9) {
          const baseFileName = file.name.replace(/\.[^/.]+$/, '');
          const newPath = `products/${baseFileName}.jpeg`;
          const thumbPath = `products/${baseFileName}_thumb.jpeg`;

          // Upload compressed version and thumbnail in parallel
          const [uploadResult, thumbResult] = await Promise.all([
            supabase.storage
              .from('product-images')
              .upload(newPath, compressedFile, {
                contentType: 'image/jpeg',
                upsert: true,
              }),
            supabase.storage
              .from('product-images')
              .upload(thumbPath, thumbnailFile, {
                contentType: 'image/jpeg',
                upsert: true,
              }),
          ]);

          if (uploadResult.error) {
            newResults.push({
              file: file.name,
              originalKB: file.sizeKB,
              newKB: file.sizeKB,
              reduction: '0%',
              status: 'error',
            });
            continue;
          }

          // Log thumbnail status
          if (thumbResult.error) {
            console.warn(`Thumbnail failed for ${file.name}:`, thumbResult.error);
          }

          // Delete old file if different name
          if (newPath !== file.path) {
            await supabase.storage
              .from('product-images')
              .remove([file.path]);
          }

          const saved = file.sizeKB - newSizeKB;
          totalSaved += saved;
          const reduction = Math.round((1 - compressedFile.size / imageBlob.size) * 100);

          newResults.push({
            file: file.name,
            originalKB: file.sizeKB,
            newKB: newSizeKB,
            reduction: `${reduction}%`,
            status: 'success',
          });
        } else {
          newResults.push({
            file: file.name,
            originalKB: file.sizeKB,
            newKB: newSizeKB,
            reduction: '0%',
            status: 'skipped',
          });
        }

        setResults([...newResults]);

        // Small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        newResults.push({
          file: file.name,
          originalKB: file.sizeKB,
          newKB: file.sizeKB,
          reduction: '0%',
          status: 'error',
        });
        setResults([...newResults]);
      }
    }

    const successCount = newResults.filter(r => r.status === 'success').length;
    
    toast({
      title: 'Otimização concluída!',
      description: `${successCount} imagens comprimidas. Economia: ${totalSaved}KB`,
    });

    setIsProcessing(false);
  };

  const successResults = results.filter(r => r.status === 'success');
  const totalSaved = successResults.reduce((sum, r) => sum + (r.originalKB - r.newKB), 0);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-bold">Otimizador de Imagens</h1>
            <p className="text-muted-foreground">
              Comprima imagens existentes para liberar espaço no storage
            </p>
          </div>

          {/* Stats Card */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.totalFiles}</div>
                  <p className="text-xs text-muted-foreground">Total de imagens</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{(stats.totalSizeKB / 1024).toFixed(1)} MB</div>
                  <p className="text-xs text-muted-foreground">Tamanho total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-500">{stats.largeFilesCount}</div>
                  <p className="text-xs text-muted-foreground">Imagens grandes (&gt;100KB)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-500">
                    {(stats.largeFilesSizeKB / 1024).toFixed(1)} MB
                  </div>
                  <p className="text-xs text-muted-foreground">Potencial economia</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Compressão em Lote
              </CardTitle>
              <CardDescription>
                Analisa e comprime imagens existentes para 80% qualidade JPEG (máx 1080px)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={loadFiles} 
                  disabled={isLoading || isProcessing}
                  variant="outline"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Analisando...' : 'Analisar Imagens'}
                </Button>

                {files.length > 0 && (
                  <Button 
                    onClick={processImages} 
                    disabled={isProcessing}
                  >
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Play className="mr-2 h-4 w-4" />
                    {isProcessing ? 'Processando...' : `Comprimir ${files.length} imagens`}
                  </Button>
                )}
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* Results Summary */}
              {results.length > 0 && !isProcessing && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Resultado</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-green-600">{successResults.length}</div>
                      <div className="text-xs text-muted-foreground">Comprimidas</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">{totalSaved} KB</div>
                      <div className="text-xs text-muted-foreground">Economizado</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {results.filter(r => r.status === 'skipped').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Já otimizadas</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results List */}
              {results.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {results.map((result, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted"
                    >
                      <span className="truncate flex-1 mr-2">{result.file}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {result.originalKB}KB → {result.newKB}KB
                        </span>
                        {result.status === 'success' && (
                          <Badge variant="default" className="bg-green-500">
                            -{result.reduction}
                          </Badge>
                        )}
                        {result.status === 'skipped' && (
                          <Badge variant="secondary">OK</Badge>
                        )}
                        {result.status === 'error' && (
                          <Badge variant="destructive">Erro</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
