-- Add color column to order_intent_items table
ALTER TABLE public.order_intent_items 
ADD COLUMN color text;