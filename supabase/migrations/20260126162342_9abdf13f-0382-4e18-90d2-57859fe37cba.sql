-- Nova RPC que adiciona ao carrinho por ATRIBUTOS (product_id + size + color)
-- Isso elimina a dependência de variant_id em cache

CREATE OR REPLACE FUNCTION public.add_cart_reservation_by_attrs(
  p_session_id text,
  p_product_id uuid,
  p_size text,
  p_color text,
  p_quantity integer,
  p_product_name text,
  p_unit_price_cents integer,
  p_image_url text
)
RETURNS cart_reservations
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.cart_reservations;
  v_variant_id uuid;
  v_stock integer;
  v_existing_qty integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  -- Busca a variante por atributos (product_id + size + color)
  -- Com lock para serializar acesso
  IF p_color IS NOT NULL AND p_color != '' THEN
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND size = p_size 
      AND color = p_color
    FOR UPDATE;
  ELSE
    -- Se não tem cor, busca variante sem cor ou qualquer uma do tamanho
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND size = p_size 
      AND (color IS NULL OR color = '')
    FOR UPDATE;
    
    -- Fallback: qualquer variante desse tamanho
    IF v_variant_id IS NULL THEN
      SELECT id, stock_qty INTO v_variant_id, v_stock
      FROM public.product_variants
      WHERE product_id = p_product_id 
        AND size = p_size
      ORDER BY stock_qty DESC
      LIMIT 1
      FOR UPDATE;
    END IF;
  END IF;

  IF v_variant_id IS NULL THEN
    RAISE EXCEPTION 'Variante não encontrada para este produto/tamanho/cor';
  END IF;

  -- Verifica estoque disponível
  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: % unidade(s)', v_stock;
  END IF;

  -- Insere ou atualiza a reserva
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
    v_variant_id,
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
$function$;