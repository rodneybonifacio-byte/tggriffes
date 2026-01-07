-- Add observations field to order_intents table
ALTER TABLE public.order_intents 
ADD COLUMN observations text DEFAULT NULL;