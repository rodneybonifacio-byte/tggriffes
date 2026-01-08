-- Create stock movements history table
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'venda', 'cancelamento')),
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view stock movements"
  ON public.stock_movements
  FOR SELECT
  USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can insert stock movements"
  ON public.stock_movements
  FOR INSERT
  WITH CHECK (is_admin_or_seller(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_stock_movements_variant ON public.stock_movements(variant_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- Enable realtime for stock movements
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;