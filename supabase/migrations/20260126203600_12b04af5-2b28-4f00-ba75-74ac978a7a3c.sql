-- Corrige a RPC para lidar melhor com cores, fazendo match case-insensitive
-- e tratando variações de strings vazias/nulas

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
  v_color_normalized text;
  v_existing_qty integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  -- Normaliza a cor recebida (trim, lowercase, ou vazio se null)
  v_color_normalized := LOWER(TRIM(COALESCE(p_color, '')));

  -- Busca a variante por atributos (product_id + size + color)
  -- Com match case-insensitive na cor
  SELECT id, stock_qty INTO v_variant_id, v_stock
  FROM public.product_variants
  WHERE product_id = p_product_id 
    AND UPPER(size) = UPPER(p_size)
    AND (
      -- Match exato (case-insensitive)
      LOWER(TRIM(COALESCE(color, ''))) = v_color_normalized
      -- OU se não encontrar, qualquer variante desse tamanho (fallback)
    )
  ORDER BY stock_qty DESC
  LIMIT 1
  FOR UPDATE;

  -- Se não encontrou com match de cor, tenta fallback sem cor
  IF v_variant_id IS NULL AND v_color_normalized != '' THEN
    -- Tenta encontrar variante sem especificar cor (para produtos single-color)
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND UPPER(size) = UPPER(p_size)
    ORDER BY stock_qty DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Se ainda não encontrou, tenta match parcial na cor
  IF v_variant_id IS NULL AND v_color_normalized != '' THEN
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND UPPER(size) = UPPER(p_size)
      AND (
        LOWER(TRIM(COALESCE(color, ''))) ILIKE '%' || v_color_normalized || '%'
        OR v_color_normalized ILIKE '%' || LOWER(TRIM(COALESCE(color, ''))) || '%'
      )
    ORDER BY stock_qty DESC
    LIMIT 1
    FOR UPDATE;
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