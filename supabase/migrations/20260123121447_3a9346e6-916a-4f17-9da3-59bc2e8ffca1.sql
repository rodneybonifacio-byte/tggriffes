-- 1) Deduplicar reservas por (session_id, variant_id) para permitir constraint de unicidade
-- Mantém a reserva mais recente e soma as quantidades; depois apaga as demais.
WITH grouped AS (
  SELECT
    session_id,
    variant_id,
    (array_agg(id ORDER BY created_at DESC))[1] AS keep_id,
    sum(quantity) AS total_qty,
    max(expires_at) AS max_expires,
    array_agg(id ORDER BY created_at DESC) AS all_ids
  FROM public.cart_reservations
  GROUP BY session_id, variant_id
  HAVING count(*) > 1
),
updated AS (
  UPDATE public.cart_reservations cr
  SET
    quantity = g.total_qty,
    expires_at = g.max_expires
  FROM grouped g
  WHERE cr.id = g.keep_id
  RETURNING cr.id
)
DELETE FROM public.cart_reservations cr
USING grouped g
WHERE cr.session_id = g.session_id
  AND cr.variant_id = g.variant_id
  AND cr.id <> g.keep_id;

-- 2) Reparar estoques negativos removendo/ajustando reservas ativas mais recentes
-- A ideia: se stock_qty < 0, há reservas a mais. Removemos exatamente (-stock_qty) unidades de reserva.
WITH negative AS (
  SELECT id AS variant_id, -stock_qty AS over
  FROM public.product_variants
  WHERE stock_qty < 0
),
active_res AS (
  SELECT
    cr.id,
    cr.variant_id,
    cr.quantity,
    cr.created_at,
    sum(cr.quantity) OVER (
      PARTITION BY cr.variant_id
      ORDER BY cr.created_at DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_sum
  FROM public.cart_reservations cr
  JOIN negative n ON n.variant_id = cr.variant_id
  WHERE cr.expires_at > now()
),
rows_to_delete AS (
  SELECT ar.id
  FROM active_res ar
  JOIN negative n ON n.variant_id = ar.variant_id
  WHERE ar.running_sum <= n.over
),
row_to_reduce AS (
  SELECT
    ar.id,
    ar.variant_id,
    ar.quantity,
    n.over,
    (ar.running_sum - ar.quantity) AS prev_sum
  FROM active_res ar
  JOIN negative n ON n.variant_id = ar.variant_id
  WHERE ar.running_sum > n.over
    AND (ar.running_sum - ar.quantity) < n.over
)
DELETE FROM public.cart_reservations
WHERE id IN (SELECT id FROM rows_to_delete);

WITH negative AS (
  SELECT id AS variant_id, -stock_qty AS over
  FROM public.product_variants
  WHERE stock_qty < 0
),
active_res AS (
  SELECT
    cr.id,
    cr.variant_id,
    cr.quantity,
    cr.created_at,
    sum(cr.quantity) OVER (
      PARTITION BY cr.variant_id
      ORDER BY cr.created_at DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_sum
  FROM public.cart_reservations cr
  JOIN negative n ON n.variant_id = cr.variant_id
  WHERE cr.expires_at > now()
),
row_to_reduce AS (
  SELECT
    ar.id,
    ar.variant_id,
    ar.quantity,
    n.over,
    (ar.running_sum - ar.quantity) AS prev_sum
  FROM active_res ar
  JOIN negative n ON n.variant_id = ar.variant_id
  WHERE ar.running_sum > n.over
    AND (ar.running_sum - ar.quantity) < n.over
)
UPDATE public.cart_reservations cr
SET quantity = cr.quantity - (r.over - r.prev_sum)
FROM row_to_reduce r
WHERE cr.id = r.id;

-- 3) Garantia final: nenhum estoque negativo permanece (casos antigos/sem reserva ativa)
UPDATE public.product_variants
SET stock_qty = 0
WHERE stock_qty < 0;

-- 4) Impedir que stock_qty volte a ficar negativo no futuro (somente quando stock_qty for alterado)
CREATE OR REPLACE FUNCTION public.prevent_negative_variant_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_qty < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_variant_stock ON public.product_variants;
CREATE TRIGGER trg_prevent_negative_variant_stock
BEFORE UPDATE OF stock_qty ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_negative_variant_stock();

-- 5) Garantir 1 reserva por variante por sessão (resolve race de inserts duplicados)
ALTER TABLE public.cart_reservations
  ADD CONSTRAINT cart_reservations_session_variant_unique
  UNIQUE (session_id, variant_id);

-- 6) RPC atômica para somar quantidade na reserva (insert + update em 1 passo)
-- Também aplica lock na variante para reduzir race conditions.
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
RETURNS public.cart_reservations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.cart_reservations;
  v_stock integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  -- Lock na variante para serializar validação de estoque
  SELECT stock_qty INTO v_stock
  FROM public.product_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF v_stock IS NULL THEN
    RAISE EXCEPTION 'Variante não encontrada';
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente';
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