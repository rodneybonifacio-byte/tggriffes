-- Remove a versão antiga da função (sem p_added_from) para resolver ambiguidade
DROP FUNCTION IF EXISTS public.add_cart_reservation_by_attrs(text, uuid, text, text, integer, text, integer, text);
