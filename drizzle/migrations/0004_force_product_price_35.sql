CREATE OR REPLACE FUNCTION public.force_product_price()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.price_cents := 3500;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_force_product_price BEFORE INSERT OR UPDATE OF price_cents ON public.products
FOR EACH ROW EXECUTE FUNCTION public.force_product_price();