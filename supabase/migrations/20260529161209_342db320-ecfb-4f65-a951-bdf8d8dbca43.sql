
-- Auto-deactivate products when total stock reaches zero, reactivate when stock returns
CREATE OR REPLACE FUNCTION public.auto_toggle_product_active_on_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_total_stock integer;
  v_currently_active boolean;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  IF v_product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(stock_qty), 0) INTO v_total_stock
  FROM public.product_variants
  WHERE product_id = v_product_id;

  SELECT active INTO v_currently_active
  FROM public.products
  WHERE id = v_product_id;

  IF v_total_stock <= 0 AND v_currently_active = true THEN
    UPDATE public.products SET active = false, updated_at = now() WHERE id = v_product_id;
  ELSIF v_total_stock > 0 AND v_currently_active = false THEN
    UPDATE public.products SET active = true, updated_at = now() WHERE id = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_toggle_product_active ON public.product_variants;
CREATE TRIGGER trg_auto_toggle_product_active
AFTER INSERT OR UPDATE OF stock_qty OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.auto_toggle_product_active_on_stock();

-- Backfill: deactivate currently-active products with zero total stock
UPDATE public.products p
SET active = false, updated_at = now()
WHERE p.active = true
  AND COALESCE((SELECT SUM(stock_qty) FROM public.product_variants v WHERE v.product_id = p.id), 0) = 0;
