CREATE OR REPLACE FUNCTION public.search_order_intents(
  p_status text DEFAULT 'all',
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_norm text;
  v_digits text;
  v_tokens text[];
  v_count bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin_or_seller(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_norm := lower(public.unaccent(coalesce(p_search, '')));
  v_digits := regexp_replace(v_norm, '\D', '', 'g');
  v_norm := regexp_replace(v_norm, '[^a-z0-9]+', ' ', 'g');

  SELECT array_agg(token) INTO v_tokens
  FROM (
    SELECT token
    FROM unnest(regexp_split_to_array(trim(v_norm), '\s+')) AS token
    WHERE token <> ''
      AND token NOT IN (
        'pedido','pedidos','ped','n','no','num','numero','nro','nr',
        'cliente','nome','telefone','tel','whatsapp','whats','zap',
        'cep','status','de','da','do','das','dos','para','por'
      )
  ) t;

  v_tokens := COALESCE(v_tokens, ARRAY[]::text[]);

  WITH matches AS MATERIALIZED (
    SELECT oi.*
    FROM public.order_intents oi
    LEFT JOIN LATERAL (
      SELECT
        string_agg(
          coalesce(item.product_name, '') || ' ' ||
          coalesce(item.size, '') || ' ' ||
          coalesce(item.color, ''),
          ' '
        ) AS item_text
      FROM public.order_intent_items item
      WHERE item.order_intent_id = oi.id
    ) items ON true
    CROSS JOIN LATERAL (
      SELECT
        regexp_replace(
          lower(public.unaccent(
            coalesce(oi.customer_name,'') || ' ' ||
            coalesce(oi.customer_whatsapp,'') || ' ' ||
            coalesce(oi.order_number::text,'') || ' ' ||
            coalesce(oi.dest_cep,'') || ' ' ||
            coalesce(oi.observations,'') || ' ' ||
            coalesce(oi.status,'') || ' ' ||
            coalesce(items.item_text,'')
          )),
          '[^a-z0-9]+', ' ', 'g'
        ) AS haystack,
        regexp_replace(
          coalesce(oi.customer_whatsapp,'') || ' ' ||
          coalesce(oi.order_number::text,'') || ' ' ||
          coalesce(oi.dest_cep,'') || ' ' ||
          coalesce(items.item_text,''),
          '\D', '', 'g'
        ) AS digits
    ) s
    WHERE (p_status = 'all' OR oi.status = p_status)
      AND (
        cardinality(v_tokens) = 0
        OR NOT EXISTS (
          SELECT 1 FROM unnest(v_tokens) AS t
          WHERE position(t IN s.haystack) = 0
            AND NOT (t ~ '^\d+$' AND position(t IN s.digits) > 0)
        )
      )
      AND (
        v_digits = ''
        OR position(v_digits IN s.digits) > 0
        OR cardinality(v_tokens) > 0
      )
  ),
  paged AS (
    SELECT *
    FROM matches
    ORDER BY created_at DESC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    (SELECT count(*) FROM matches),
    (SELECT COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY paged.created_at DESC), '[]'::jsonb) FROM paged)
  INTO v_count, v_rows;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb), 'total', COALESCE(v_count, 0));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_order_intents(text, text, integer, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_order_intents(text, text, integer, integer) FROM anon, public;