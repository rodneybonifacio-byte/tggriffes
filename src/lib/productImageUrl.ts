/**
 * Product Image URL Utility
 * 
 * Provides robust image URL handling with Shopify CDN as primary source
 * and Supabase Storage as fallback. Ensures zero broken images.
 */

// Cache-bust version - increment to force refresh
const CACHE_VERSION = 'v3';

/**
 * Get the best available image URL for a product.
 * Priority: Shopify CDN > Supabase main_image_url
 * 
 * @param shopifyImageUrl - Shopify CDN URL (from sync)
 * @param supabaseImageUrl - Supabase Storage URL (local backup)
 * @param size - Optional Shopify size suffix (e.g., '400x', '800x')
 * @returns The best available image URL with cache-busting
 */
export function getProductImageUrl(
  shopifyImageUrl: string | null | undefined,
  supabaseImageUrl: string | null | undefined,
  size?: '100x' | '200x' | '400x' | '800x' | '1024x'
): string {
  // Priority 1: Shopify CDN URL (if available and valid)
  if (shopifyImageUrl && isValidUrl(shopifyImageUrl)) {
    // Shopify supports automatic resizing by appending _[size] before extension
    // e.g., https://cdn.shopify.com/.../product_400x.jpg
    if (size) {
      return addShopifySize(shopifyImageUrl, size);
    }
    return shopifyImageUrl;
  }
  
  // Priority 2: Supabase Storage URL (fallback)
  if (supabaseImageUrl && isValidUrl(supabaseImageUrl)) {
    return addCacheBusting(supabaseImageUrl);
  }
  
  // No valid image available
  return '';
}

/**
 * Get thumbnail URL (400px) for listings/cards
 */
export function getProductThumbnailUrl(
  shopifyImageUrl: string | null | undefined,
  supabaseImageUrl: string | null | undefined
): string {
  return getProductImageUrl(shopifyImageUrl, supabaseImageUrl, '400x');
}

/**
 * Get full resolution URL for product detail/gallery
 */
export function getProductFullImageUrl(
  shopifyImageUrl: string | null | undefined,
  supabaseImageUrl: string | null | undefined
): string {
  // No size suffix for full resolution
  return getProductImageUrl(shopifyImageUrl, supabaseImageUrl);
}

/**
 * Add Shopify size suffix to URL
 * Converts: .../image.jpg → .../image_400x.jpg
 */
function addShopifySize(url: string, size: string): string {
  // Check if already has size suffix
  if (url.match(/_\d+x\.(jpg|jpeg|png|webp|gif)/i)) {
    return url;
  }
  
  // Insert size before extension
  return url.replace(/\.(jpg|jpeg|png|webp|gif)/i, `_${size}.$1`);
}

/**
 * Add cache-busting parameter to URL
 */
function addCacheBusting(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}cb=${CACHE_VERSION}`;
}

/**
 * Check if URL is valid and absolute
 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Create an onError handler for images that falls back to Supabase
 * Use this on <img> tags to ensure graceful degradation
 */
export function createImageFallbackHandler(
  supabaseImageUrl: string | null | undefined
): (e: React.SyntheticEvent<HTMLImageElement>) => void {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fallbackUrl = supabaseImageUrl;
    
    // Only try fallback if we have one and haven't already tried it
    if (fallbackUrl && !img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'true';
      img.src = addCacheBusting(fallbackUrl);
    }
  };
}
