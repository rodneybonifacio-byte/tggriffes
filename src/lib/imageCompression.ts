/**
 * Compresses an image file to reduce storage usage
 * Converts to JPEG at specified quality and max dimensions
 */
export async function compressImage(
  file: File, 
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const { maxDimension = 1080, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      try {
        let { width, height } = img;

        // Maintain aspect ratio while constraining to max dimension
        if (width > height && width > maxDimension) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create new file with jpeg extension
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '.jpeg'),
              { type: 'image/jpeg' }
            );

            console.log(
              `Image compressed (${maxDimension}px): ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${((1 - compressedFile.size / file.size) * 100).toFixed(0)}% reduction)`
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a thumbnail version (400px) of an image
 */
export async function generateThumbnail(file: File): Promise<File> {
  return compressImage(file, { maxDimension: 400, quality: 0.75 });
}

/**
 * Convert a full-size image URL to its thumbnail URL
 * Thumbnail files are stored with _thumb suffix before extension
 */
export function getThumbnailUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  
  // Only add _thumb to images we know have thumbnails (.jpeg files)
  // For other extensions, return the original URL
  if (originalUrl.endsWith('.jpeg')) {
    return originalUrl.replace(/\.jpeg$/, '_thumb.jpeg');
  }
  
  // For non-jpeg images (legacy .webp, .png, etc), return original URL
  return originalUrl;
}

/**
 * Check if a thumbnail URL exists, with fallback to original
 * Returns thumbnail URL if it exists, otherwise original
 */
export function getOptimizedImageUrl(originalUrl: string, preferThumbnail = true): string {
  if (!originalUrl || !preferThumbnail) return originalUrl;
  return getThumbnailUrl(originalUrl);
}
