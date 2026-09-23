CREATE OR REPLACE FUNCTION public.enforce_order_item_commerce_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    RAISE EXCEPTION 'A quantidade do item deve ser maior que zero';
  END IF;

  NEW.unit_price_cents := 3500;
  NEW.line_total_cents := 3500 * NEW.qty;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_item_commerce_rule ON public.order_intent_items;
CREATE TRIGGER trg_enforce_order_item_commerce_rule
BEFORE INSERT OR UPDATE OF qty, unit_price_cents, line_total_cents
ON public.order_intent_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_item_commerce_rule();

CREATE OR REPLACE FUNCTION public.recalculate_order_commerce_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order_id uuid;
  calculated_subtotal integer;
BEGIN
  target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_intent_id ELSE NEW.order_intent_id END;

  SELECT COALESCE(SUM(line_total_cents), 0)::integer
  INTO calculated_subtotal
  FROM public.order_intent_items
  WHERE order_intent_id = target_order_id;

  UPDATE public.order_intents
  SET subtotal_cents = calculated_subtotal,
      total_cents = calculated_subtotal + COALESCE(shipping_price_cents, 0)
  WHERE id = target_order_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_order_commerce_totals ON public.order_intent_items;
CREATE TRIGGER trg_recalculate_order_commerce_totals
AFTER INSERT OR UPDATE OF qty, unit_price_cents, line_total_cents OR DELETE
ON public.order_intent_items
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_order_commerce_totals();

CREATE OR REPLACE FUNCTION public.force_public_orders_to_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'NOVO' AND NOT public.is_admin_or_seller(auth.uid()) THEN
    NEW.status := 'RASCUNHO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_public_orders_to_draft ON public.order_intents;
CREATE TRIGGER trg_force_public_orders_to_draft
BEFORE INSERT ON public.order_intents
FOR EACH ROW
EXECUTE FUNCTION public.force_public_orders_to_draft();

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status
  FROM public.order_intents
  WHERE id = NEW.order_intent_id;

  IF parent_status <> 'RASCUNHO' THEN
    UPDATE public.product_variants
    SET stock_qty = stock_qty - NEW.qty
    WHERE id = NEW.variant_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_public_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_quantity integer;
  invalid_stock boolean;
BEGIN
  PERFORM 1
  FROM public.order_intents
  WHERE id = p_order_id AND status = 'RASCUNHO'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já finalizado';
  END IF;

  SELECT COALESCE(SUM(qty), 0)::integer
  INTO order_quantity
  FROM public.order_intent_items
  WHERE order_intent_id = p_order_id;

  IF order_quantity < 10 THEN
    RAISE EXCEPTION 'O pedido mínimo é de 10 peças';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT variant_id, SUM(qty)::integer AS required_qty
      FROM public.order_intent_items
      WHERE order_intent_id = p_order_id
      GROUP BY variant_id
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
    FROM public.order_intent_items
    WHERE order_intent_id = p_order_id
    GROUP BY variant_id
  ) requested
  WHERE variants.id = requested.variant_id;

  UPDATE public.order_intents
  SET status = 'NOVO'
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_public_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_public_order(uuid) TO anon, authenticated, service_role;