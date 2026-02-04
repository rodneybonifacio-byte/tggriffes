-- Atualiza a função add_cart_reservation_by_attrs para aceitar o parâmetro added_from
CREATE OR REPLACE FUNCTION public.add_cart_reservation_by_attrs(
  p_session_id text, 
  p_product_id uuid, 
  p_size text, 
  p_color text, 
  p_quantity integer, 
  p_product_name text, 
  p_unit_price_cents integer, 
  p_image_url text,
  p_added_from text DEFAULT 'catalog'
)
RETURNS cart_reservations
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF p_unit_price_cents IS NULL OR p_unit_price_cents <= 0 THEN
    RAISE EXCEPTION 'Preço inválido: o produto não pode ter preço zero';
  END IF;

  -- Normaliza a cor recebida (trim, lowercase, ou vazio se null)
  v_color_normalized := LOWER(TRIM(COALESCE(p_color, '')));

  -- 1. Primeiro tenta match EXATO de cor (case-insensitive)
  SELECT id, stock_qty INTO v_variant_id, v_stock
  FROM public.product_variants
  WHERE product_id = p_product_id 
    AND UPPER(TRIM(size)) = UPPER(TRIM(p_size))
    AND LOWER(TRIM(COALESCE(color, ''))) = v_color_normalized
  ORDER BY stock_qty DESC
  LIMIT 1
  FOR UPDATE;

  -- 2. Se não achou e cor foi passada, tenta match parcial (ILIKE)
  IF v_variant_id IS NULL AND v_color_normalized != '' THEN
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND UPPER(TRIM(size)) = UPPER(TRIM(p_size))
      AND (
        LOWER(TRIM(COALESCE(color, ''))) ILIKE '%' || v_color_normalized || '%'
        OR v_color_normalized ILIKE '%' || LOWER(TRIM(COALESCE(color, ''))) || '%'
      )
    ORDER BY stock_qty DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- 3. Fallback: pega qualquer variante desse tamanho (para produtos single-color ou cor diferente)
  IF v_variant_id IS NULL THEN
    SELECT id, stock_qty INTO v_variant_id, v_stock
    FROM public.product_variants
    WHERE product_id = p_product_id 
      AND UPPER(TRIM(size)) = UPPER(TRIM(p_size))
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
    expires_at,
    added_from
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
    now() + interval '30 minutes',
    COALESCE(p_added_from, 'catalog')
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
    -- Não atualiza added_from em upsert - mantém a primeira origem
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;