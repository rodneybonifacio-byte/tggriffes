import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Upload, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { compressImage, generateThumbnail } from '@/lib/imageCompression';

interface ImageUploadProps {
  images: string[];
  mainImage?: string;
  onImagesChange: (images: string[]) => void;
  onMainImageChange?: (url: string) => void;
  productId?: string;
}

export function ImageUpload({ 
  images, 
  mainImage, 
  onImagesChange, 
  onMainImageChange,
  productId 
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const baseFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Compress original image (1080px) and generate thumbnail (400px) in parallel
        const [compressedFile, thumbnailFile] = await Promise.all([
          compressImage(file),
          generateThumbnail(file),
        ]);
        
        const originalPath = `products/${baseFileName}.jpeg`;
        const thumbnailPath = `products/${baseFileName}_thumb.jpeg`;

        // Upload both versions in parallel
        const [originalUpload, thumbnailUpload] = await Promise.all([
          supabase.storage
            .from('product-images')
            .upload(originalPath, compressedFile, { contentType: 'image/jpeg' }),
          supabase.storage
            .from('product-images')
            .upload(thumbnailPath, thumbnailFile, { contentType: 'image/jpeg' }),
        ]);

        if (originalUpload.error) throw originalUpload.error;
        
        // Log thumbnail upload status (non-blocking)
        if (thumbnailUpload.error) {
          console.warn('Thumbnail upload failed:', thumbnailUpload.error);
        } else {
          console.log(`Thumbnail created: ${(thumbnailFile.size / 1024).toFixed(1)}KB`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(originalPath);

        return publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      const updatedImages = [...images, ...newUrls];
      onImagesChange(updatedImages);

      if (!mainImage && newUrls.length > 0) {
        onMainImageChange?.(newUrls[0]);
      }

      toast({
        title: 'Upload concluído',
        description: `${newUrls.length} imagem(ns) enviada(s) com thumbnails.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar as imagens.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [images, mainImage, onImagesChange, onMainImageChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: true,
  });

  const removeImage = async (urlToRemove: string) => {
    const updatedImages = images.filter(url => url !== urlToRemove);
    onImagesChange(updatedImages);
    
    if (mainImage === urlToRemove && updatedImages.length > 0) {
      onMainImageChange?.(updatedImages[0]);
    } else if (mainImage === urlToRemove) {
      onMainImageChange?.('');
    }

    // Also try to delete thumbnail (best effort, non-blocking)
    try {
      const pathMatch = urlToRemove.match(/\/products\/([^?]+)/);
      if (pathMatch) {
        const originalFileName = pathMatch[1];
        const thumbFileName = originalFileName.replace(/\.jpeg$/, '_thumb.jpeg');
        await supabase.storage
          .from('product-images')
          .remove([`products/${thumbFileName}`]);
      }
    } catch (e) {
      // Ignore thumbnail deletion errors
    }
  };

  const setAsMain = (url: string) => {
    onMainImageChange?.(url);
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          isUploading && "opacity-50 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p>Solte as imagens aqui...</p>
        ) : (
          <div>
            <p className="font-medium">Arraste imagens ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground mt-1">PNG, JPG ou WEBP • Gera thumbnail 400px automaticamente</p>
          </div>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div
              key={url}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border-2 group",
                mainImage === url ? "border-primary" : "border-transparent"
              )}
            >
              <img
                src={url}
                alt={`Imagem ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAsMain(url)}
                  title="Definir como principal"
                >
                  <Star className={cn("h-4 w-4", mainImage === url && "fill-warning text-warning")} />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeImage(url)}
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Main badge */}
              {mainImage === url && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  Principal
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
