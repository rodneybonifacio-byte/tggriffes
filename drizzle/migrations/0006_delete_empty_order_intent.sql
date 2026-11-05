CREATE OR REPLACE FUNCTION public.delete_empty_order_intent(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items int;
BEGIN
  SELECT COUNT(*) INTO v_items FROM public.order_intent_items WHERE order_intent_id = p_order_id;
  IF v_items > 0 THEN
    RETURN false;
  END IF;
  DELETE FROM public.order_intents WHERE id = p_order_id AND status IN ('RASCUNHO','NOVO');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_empty_order_intent(uuid) TO anon, authenticated, service_role;