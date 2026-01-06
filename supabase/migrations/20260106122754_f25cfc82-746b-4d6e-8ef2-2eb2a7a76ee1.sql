-- Create promotions table for quantity-based pricing rules
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed_price', 'fixed_discount')),
  discount_value INTEGER NOT NULL DEFAULT 0, -- percentage (0-100) or cents
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active promotions" 
ON public.promotions 
FOR SELECT 
USING (active = true);

CREATE POLICY "Admins can view all promotions" 
ON public.promotions 
FOR SELECT 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can insert promotions" 
ON public.promotions 
FOR INSERT 
WITH CHECK (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can update promotions" 
ON public.promotions 
FOR UPDATE 
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Admins can delete promotions" 
ON public.promotions 
FOR DELETE 
USING (is_admin_or_seller(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();