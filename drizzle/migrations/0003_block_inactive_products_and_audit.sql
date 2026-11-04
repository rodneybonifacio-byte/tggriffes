CREATE TABLE public.product_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_name text,
  old_active boolean,
  new_active boolean,
  changed_by uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_status_log TO authenticated;
GRANT ALL ON public.product_status_log TO service_role;
ALTER TABLE public.product_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read product status log" ON public.product_status_log FOR SELECT TO authenticated USING (public.is_admin_or_seller(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_product_active_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    INSERT INTO public.product_status_log(product_id, product_name, old_active, new_active, changed_by, source)
    VALUES (NEW.id, NEW.name, OLD.active, NEW.active, auth.uid(),
      COALESCE(current_setting('request.jwt.claim.role', true), current_user::text));
    IF NEW.active = false THEN
      DELETE FROM public.cart_reservations WHERE product_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_product_active_change AFTER UPDATE OF active ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_active_change();

CREATE OR REPLACE FUNCTION public.block_inactive_product_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active boolean;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'order_intent_items' AND public.is_admin_or_seller(auth.uid()) THEN RETURN NEW; END IF;
  SELECT active INTO v_active FROM public.products WHERE id = NEW.product_id;
  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Produto indisponível: % não está mais à venda', COALESCE(NEW.product_name, 'este produto');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_block_inactive_reservation BEFORE INSERT OR UPDATE OF quantity ON public.cart_reservations
FOR EACH ROW EXECUTE FUNCTION public.block_inactive_product_purchase();
CREATE TRIGGER trg_block_inactive_order_item BEFORE INSERT ON public.order_intent_items
FOR EACH ROW EXECUTE FUNCTION public.block_inactive_product_purchase();