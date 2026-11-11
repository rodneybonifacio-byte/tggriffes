CREATE OR REPLACE FUNCTION public.finalize_public_order(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_quantity integer;
  distinct_sizes integer;
  invalid_stock boolean;
BEGIN
  PERFORM 1 FROM public.order_intents
  WHERE id = p_order_id AND status = 'RASCUNHO' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já finalizado';
  END IF;

  SELECT COALESCE(SUM(qty), 0)::integer, COUNT(DISTINCT upper(trim(size)))::integer
  INTO order_quantity, distinct_sizes
  FROM public.order_intent_items WHERE order_intent_id = p_order_id;

  IF order_quantity < 10 THEN
    RAISE EXCEPTION 'O pedido mínimo é de 10 peças';
  END IF;
  IF distinct_sizes < 2 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos 2 tamanhos diferentes';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT variant_id, SUM(qty)::integer AS required_qty
      FROM public.order_intent_items WHERE order_intent_id = p_order_id GROUP BY variant_id
    ) requested
    LEFT JOIN public.product_variants variants ON variants.id = requested.variant_id
    WHERE variants.id IS NULL OR variants.stock_qty < requested.required_qty
  ) INTO invalid_stock;
  IF invalid_stock THEN
    RAISE EXCEPTION 'Estoque insuficiente para finalizar o pedido';
  END IF;

  UPDATE public.product_variants variants
  SET stock_qty = variants.stock_qty - requested.required_qty
  FROM (
    SELECT variant_id, SUM(qty)::integer AS required_qty
    FROM public.order_intent_items WHERE order_intent_id = p_order_id GROUP BY variant_id
  ) requested
  WHERE variants.id = requested.variant_id;

  UPDATE public.order_intents SET status = 'NOVO' WHERE id = p_order_id;
  RETURN true;
END;
$function$;