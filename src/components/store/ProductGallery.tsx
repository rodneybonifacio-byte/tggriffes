import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductImage } from '@/hooks/useProducts';
import { getProductFullImageUrl, getProductThumbnailUrl, createImageFallbackHandler } from '@/lib/productImageUrl';

interface ProductGalleryProps {
  images: ProductImage[];
  mainImage?: string | null;
  shopifyImageUrl?: string | null;
  productName: string;
}

export function ProductGallery({ images, mainImage, shopifyImageUrl, productName }: ProductGalleryProps) {
  // Build images array: Shopify CDN as primary for main, Supabase for gallery
  const mainUrl = getProductFullImageUrl(shopifyImageUrl, mainImage);
  
  const allImages = mainUrl
    ? [{ id: 'main', image_url: mainUrl, sort_order: -1 }, ...images.filter(img => img.image_url !== mainImage)]
    : images;
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allImages.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  // Fallback handler: if Shopify/current image fails, try Supabase main image
  const handleImageError = createImageFallbackHandler(mainImage);

  if (allImages.length === 0) {
    return (
      <div className="aspect-square bg-secondary rounded-lg flex items-center justify-center">
        <svg className="h-24 w-24 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Image - uses full resolution from Shopify CDN with Supabase fallback */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
        <img
          src={currentIndex === 0 ? mainUrl : getProductFullImageUrl(null, allImages[currentIndex]?.image_url)}
          alt={`${productName} - Imagem ${currentIndex + 1}`}
          className="h-full w-full object-cover"
          loading="lazy"
          crossOrigin="anonymous"
          onError={handleImageError}
        />
        
        {allImages.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hover:opacity-100"
              onClick={goToPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hover:opacity-100"
              onClick={goToNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Thumbnails - uses 400px thumbnails for smaller previews */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {allImages.map((image, index) => {
            const thumbUrl = index === 0 
              ? getProductThumbnailUrl(shopifyImageUrl, mainImage)
              : getProductThumbnailUrl(null, image.image_url);
            
            return (
              <button
                key={image.id}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                  currentIndex === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={thumbUrl}
                  alt={`${productName} - Miniatura ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  crossOrigin="anonymous"
                  onError={handleImageError}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
