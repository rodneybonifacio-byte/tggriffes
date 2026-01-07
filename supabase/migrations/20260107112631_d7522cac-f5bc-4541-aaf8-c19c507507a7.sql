-- Create order history table for tracking changes
CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_intent_id UUID NOT NULL REFERENCES public.order_intents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'created', 'updated', 'item_added', 'item_removed', 'item_updated', 'status_changed'
  description TEXT NOT NULL,
  changes JSONB, -- Store the actual changes made
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Admins/sellers can view order history
CREATE POLICY "Admins can view order history" 
ON public.order_history 
FOR SELECT 
USING (is_admin_or_seller(auth.uid()));

-- Admins/sellers can insert order history
CREATE POLICY "Admins can insert order history" 
ON public.order_history 
FOR INSERT 
WITH CHECK (is_admin_or_seller(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_order_history_order_intent_id ON public.order_history(order_intent_id);
CREATE INDEX idx_order_history_created_at ON public.order_history(created_at DESC);