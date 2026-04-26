ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS display_order INTEGER,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_from_home BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(display_order);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured) WHERE is_featured = true;