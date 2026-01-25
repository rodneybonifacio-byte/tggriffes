-- Drop the old check constraint and add a new one with shopify_sale
ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_movement_type_check;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
CHECK (movement_type = ANY (ARRAY['entrada'::text, 'saida'::text, 'ajuste'::text, 'venda'::text, 'cancelamento'::text, 'shopify_sale'::text]));