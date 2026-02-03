-- Add shipping package metrics columns to order_intents
ALTER TABLE public.order_intents
  ADD COLUMN IF NOT EXISTS shipping_weight_grams integer,
  ADD COLUMN IF NOT EXISTS shipping_length_cm integer,
  ADD COLUMN IF NOT EXISTS shipping_width_cm integer,
  ADD COLUMN IF NOT EXISTS shipping_height_cm integer;