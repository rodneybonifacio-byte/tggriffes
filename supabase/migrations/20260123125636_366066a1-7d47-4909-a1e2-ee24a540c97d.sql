-- Fix add_cart_reservation to properly validate stock considering existing reservation
CREATE OR REPLACE FUNCTION public.add_cart_reservation(
  p_session_id text,
  p_variant_id uuid,
  p_product_id uuid,
  p_product_name text,
  p_size text,
  p_color text,
  p_quantity integer,
  p_unit_price_cents integer,
  p_image_url text
)
RETURNS cart_reservations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.cart_reservations;
  v_stock integer;
  v_existing_qty integer;
  v_total_requested integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  -- Lock variant row to serialize stock validation
  SELECT stock_qty INTO v_stock
  FROM public.product_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF v_stock IS NULL THEN
    RAISE EXCEPTION 'Variante não encontrada';
  END IF;

  -- Check if there's an existing reservation for this session+variant
  SELECT quantity INTO v_existing_qty
  FROM public.cart_reservations
  WHERE session_id = p_session_id AND variant_id = p_variant_id;
  
  -- Calculate total that would be requested after this operation
  v_total_requested := COALESCE(v_existing_qty, 0) + p_quantity;
  
  -- Validate: stock must be >= additional quantity being requested
  -- (existing reservation already decremented stock, so we just check if p_quantity more is available)
  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: % unidade(s)', v_stock;
  END IF;

  INSERT INTO public.cart_reservations (
    session_id,
    variant_id,
    product_id,
    product_name,
    size,
    color,
    quantity,
    unit_price_cents,
    image_url,
    expires_at
  ) VALUES (
    p_session_id,
    p_variant_id,
    p_product_id,
    p_product_name,
    p_size,
    p_color,
    p_quantity,
    p_unit_price_cents,
    p_image_url,
    now() + interval '30 minutes'
  )
  ON CONFLICT (session_id, variant_id)
  DO UPDATE SET
    product_id = EXCLUDED.product_id,
    product_name = EXCLUDED.product_name,
    size = EXCLUDED.size,
    color = EXCLUDED.color,
    unit_price_cents = EXCLUDED.unit_price_cents,
    image_url = EXCLUDED.image_url,
    quantity = public.cart_reservations.quantity + EXCLUDED.quantity,
    expires_at = GREATEST(public.cart_reservations.expires_at, EXCLUDED.expires_at)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;