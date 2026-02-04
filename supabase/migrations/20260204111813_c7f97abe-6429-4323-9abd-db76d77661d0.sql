-- Adiciona campo added_from na tabela cart_reservations
ALTER TABLE public.cart_reservations 
ADD COLUMN IF NOT EXISTS added_from text DEFAULT 'catalog';

-- Adiciona campo added_from na tabela order_intent_items
ALTER TABLE public.order_intent_items 
ADD COLUMN IF NOT EXISTS added_from text DEFAULT 'catalog';

-- Comentários para documentação
COMMENT ON COLUMN public.cart_reservations.added_from IS 'Origem da adição: catalog (catálogo) ou product_page (página do produto)';
COMMENT ON COLUMN public.order_intent_items.added_from IS 'Origem da adição: catalog (catálogo) ou product_page (página do produto)';