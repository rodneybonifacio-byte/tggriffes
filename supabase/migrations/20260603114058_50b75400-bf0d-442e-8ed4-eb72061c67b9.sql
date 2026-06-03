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
        'pedido','pedidos','ped','n','no','num','numero','nro',
        'cliente','nome','telefone','tel','whatsapp','whats','zap',
        'cep','status'
      )
  ) t;

  v_tokens := COALESCE(v_tokens, ARRAY[]::text[]);

  CREATE TEMP TABLE IF NOT EXISTS _search_matches (
    id uuid,
    created_at timestamptz,
    row_data jsonb
  ) ON COMMIT DROP;
  DELETE FROM _search_matches;

  INSERT INTO _search_matches (id, created_at, row_data)
  SELECT
    oi.id,
    oi.created_at,
    to_jsonb(oi)
  FROM public.order_intents oi
  CROSS JOIN LATERAL (
    SELECT
      regexp_replace(
        lower(public.unaccent(
          coalesce(oi.customer_name,'') || ' ' ||
          coalesce(oi.customer_whatsapp,'') || ' ' ||
          coalesce(oi.order_number::text,'') || ' ' ||
          coalesce(oi.dest_cep,'') || ' ' ||
          coalesce(oi.observations,'') || ' ' ||
          coalesce(oi.status,'')
        )),
        '[^a-z0-9]+', ' ', 'g'
      ) AS haystack,
      regexp_replace(
        coalesce(oi.customer_whatsapp,'') || ' ' ||
        coalesce(oi.order_number::text,'') || ' ' ||
        coalesce(oi.dest_cep,''),
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
    );

  SELECT count(*) INTO v_count FROM _search_matches;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT row_data, created_at
    FROM _search_matches
    ORDER BY created_at DESC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  ) p;

  RETURN jsonb_build_object('rows', v_rows, 'total', COALESCE(v_count, 0));
END;
$function$;