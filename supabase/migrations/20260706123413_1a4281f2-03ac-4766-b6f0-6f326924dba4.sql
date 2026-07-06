
CREATE INDEX IF NOT EXISTS idx_products_active_created_at ON public.products (active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_order_intent_items_created_at ON public.order_intent_items (created_at DESC);
ANALYZE public.products;
ANALYZE public.product_images;
ANALYZE public.product_variants;
ANALYZE public.order_intents;
ANALYZE public.order_intent_items;
ANALYZE public.page_views;
