CREATE OR REPLACE FUNCTION public.request_cart_session()
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-cart-session', '')
$$;

DROP POLICY IF EXISTS "Anyone can delete cart reservations" ON public.cart_reservations;
DROP POLICY IF EXISTS "Anyone can update cart reservations" ON public.cart_reservations;
DROP POLICY IF EXISTS "Anyone can insert cart reservations" ON public.cart_reservations;
DROP POLICY IF EXISTS "Anyone can view cart reservations" ON public.cart_reservations;

CREATE POLICY "Own session or staff can view cart reservations" ON public.cart_reservations
  FOR SELECT TO anon, authenticated
  USING (session_id = public.request_cart_session() OR public.is_admin_or_seller(auth.uid()));
CREATE POLICY "Own session or staff can insert cart reservations" ON public.cart_reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (session_id = public.request_cart_session() OR public.is_admin_or_seller(auth.uid()));
CREATE POLICY "Own session or staff can update cart reservations" ON public.cart_reservations
  FOR UPDATE TO anon, authenticated
  USING (session_id = public.request_cart_session() OR public.is_admin_or_seller(auth.uid()))
  WITH CHECK (session_id = public.request_cart_session() OR public.is_admin_or_seller(auth.uid()));
CREATE POLICY "Own session or staff can delete cart reservations" ON public.cart_reservations
  FOR DELETE TO anon, authenticated
  USING (session_id = public.request_cart_session() OR public.is_admin_or_seller(auth.uid()));