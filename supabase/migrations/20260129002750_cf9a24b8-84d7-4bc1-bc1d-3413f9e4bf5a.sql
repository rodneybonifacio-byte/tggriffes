-- Add shopify_image_url column to products table
-- This will store the Shopify CDN URL for product images
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS shopify_image_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.products.shopify_image_url IS 'Shopify CDN URL for main product image. Used for serving images via Shopify Fastly CDN to reduce egress costs.';

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_shopify_image_url ON public.products(shopify_image_url) WHERE shopify_image_url IS NOT NULL;