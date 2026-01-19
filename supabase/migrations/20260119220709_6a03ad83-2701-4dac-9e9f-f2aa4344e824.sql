-- Tabela para mapear produtos locais com produtos do Shopify
CREATE TABLE public.shopify_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  shopify_product_handle TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id),
  UNIQUE(shopify_product_id)
);

-- Tabela para mapear variantes locais com variantes do Shopify
CREATE TABLE public.shopify_variant_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  shopify_variant_id TEXT NOT NULL,
  shopify_inventory_item_id TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(variant_id),
  UNIQUE(shopify_variant_id)
);

-- Enable RLS
ALTER TABLE public.shopify_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_variant_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can access
CREATE POLICY "Admins can view shopify mappings" 
ON public.shopify_product_mappings 
FOR SELECT 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can manage shopify mappings" 
ON public.shopify_product_mappings 
FOR ALL 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can view shopify variant mappings" 
ON public.shopify_variant_mappings 
FOR SELECT 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can manage shopify variant mappings" 
ON public.shopify_variant_mappings 
FOR ALL 
USING (is_admin_or_seller(auth.uid()));

-- Log de sincronização
CREATE TABLE public.shopify_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'product', 'inventory', 'full'
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  products_synced INTEGER DEFAULT 0,
  variants_synced INTEGER DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs" 
ON public.shopify_sync_logs 
FOR SELECT 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Anyone can insert sync logs" 
ON public.shopify_sync_logs 
FOR INSERT 
WITH CHECK (true);