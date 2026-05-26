-- Tabela de visitas / page views
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,           -- ID anônimo persistido em localStorage
  session_id text,                    -- ID da sessão (sessionStorage)
  path text NOT NULL,                 -- ex: "/produto/camisa-x"
  page_type text,                     -- 'home' | 'product' | 'other'
  product_id uuid,                    -- preenchido quando é página de produto
  referrer text,                      -- document.referrer
  traffic_source text,                -- 'whatsapp' | 'direct' | 'google' | 'instagram' | 'facebook' | 'other'
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_visitor_id ON public.page_views(visitor_id);
CREATE INDEX idx_page_views_product_id ON public.page_views(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_page_views_traffic_source ON public.page_views(traffic_source);

-- RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view page views"
  ON public.page_views FOR SELECT
  USING (is_admin_or_seller(auth.uid()));