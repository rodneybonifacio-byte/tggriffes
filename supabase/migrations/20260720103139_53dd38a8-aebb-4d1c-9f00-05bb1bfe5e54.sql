
-- Índices para as agregações do dashboard
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON public.page_views (visitor_id);
CREATE INDEX IF NOT EXISTS idx_order_intent_items_created_at ON public.order_intent_items (created_at DESC);

-- ==========================================================================
-- dashboard_visits_summary
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.dashboard_visits_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz;
  v_result jsonb;
  v_total_views bigint;
  v_unique bigint;
  v_returning bigint;
  v_new bigint;
  v_daily jsonb;
  v_sources jsonb;
  v_mediums jsonb;
  v_domains jsonb;
  v_campaigns jsonb;
  v_devices jsonb;
  v_products jsonb;
BEGIN
  IF NOT public.is_admin_or_seller(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_since := date_trunc('day', now()) - make_interval(days => GREATEST(p_days, 1) - 1);

  -- Base filtered rows (excluir ambientes de desenvolvimento)
  WITH base AS (
    SELECT
      pv.visitor_id,
      pv.path,
      pv.page_type,
      COALESCE(NULLIF(pv.traffic_source, ''), 'direct')  AS traffic_source,
      COALESCE(NULLIF(pv.traffic_medium, ''), 'direct')  AS traffic_medium,
      pv.referrer_domain,
      pv.utm_campaign,
      COALESCE(NULLIF(pv.device_type, ''), 'unknown')    AS device_type,
      pv.created_at
    FROM public.page_views pv
    WHERE pv.created_at >= v_since
      AND (
        pv.referrer_domain IS NULL
        OR (
          lower(pv.referrer_domain) NOT LIKE '%lovable.app%'
          AND lower(pv.referrer_domain) NOT LIKE '%lovable.dev%'
          AND lower(pv.referrer_domain) NOT LIKE '%lovableproject.com%'
          AND lower(pv.referrer_domain) NOT LIKE '%lovable.%'
          AND lower(pv.referrer_domain) <> 'localhost'
          AND pv.referrer_domain <> '127.0.0.1'
        )
      )
  )
  SELECT
    COUNT(*),
    COUNT(DISTINCT visitor_id)
  INTO v_total_views, v_unique
  FROM base;

  -- Novos vs. recorrentes (baseado em quem já tinha visita antes da janela)
  WITH visitors AS (
    SELECT DISTINCT pv.visitor_id
    FROM public.page_views pv
    WHERE pv.created_at >= v_since
  ),
  prior AS (
    SELECT DISTINCT pv.visitor_id
    FROM public.page_views pv
    JOIN visitors v USING (visitor_id)
    WHERE pv.created_at < v_since
  )
  SELECT
    (SELECT COUNT(*) FROM prior),
    (SELECT COUNT(*) FROM visitors) - (SELECT COUNT(*) FROM prior)
  INTO v_returning, v_new;

  -- Daily trend (garante todos os dias mesmo sem visita)
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', v_since)::date,
      date_trunc('day', now())::date,
      interval '1 day'
    )::date AS d
  ),
  agg AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d,
           COUNT(*) AS views,
           COUNT(DISTINCT visitor_id) AS uniq
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(days.d, 'YYYY-MM-DD'),
    'views', COALESCE(agg.views, 0),
    'uniqueVisitors', COALESCE(agg.uniq, 0)
  ) ORDER BY days.d), '[]'::jsonb)
  INTO v_daily
  FROM days LEFT JOIN agg ON agg.d = days.d;

  -- Traffic sources
  WITH src AS (
    SELECT COALESCE(NULLIF(traffic_source, ''), 'direct') AS source, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM src)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', source,
    'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb)
  INTO v_sources FROM src;

  -- Traffic mediums
  WITH med AS (
    SELECT COALESCE(NULLIF(traffic_medium, ''), 'direct') AS medium, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM med)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'medium', medium,
    'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb)
  INTO v_mediums FROM med;

  -- Referrer domains
  SELECT COALESCE(jsonb_agg(jsonb_build_object('domain', domain, 'views', views) ORDER BY views DESC), '[]'::jsonb)
  INTO v_domains
  FROM (
    SELECT referrer_domain AS domain, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND referrer_domain IS NOT NULL
      AND lower(referrer_domain) NOT LIKE '%lovable%'
      AND lower(referrer_domain) <> 'localhost'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 8
  ) t;

  -- Campaigns
  SELECT COALESCE(jsonb_agg(jsonb_build_object('campaign', campaign, 'views', views) ORDER BY views DESC), '[]'::jsonb)
  INTO v_campaigns
  FROM (
    SELECT utm_campaign AS campaign, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND utm_campaign IS NOT NULL
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 6
  ) t;

  -- Devices
  WITH dev AS (
    SELECT COALESCE(NULLIF(device_type, ''), 'unknown') AS device, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM dev)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'device', device,
    'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb)
  INTO v_devices FROM dev;

  -- Top products
  WITH top_paths AS (
    SELECT path, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND page_type = 'product'
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
      AND path IS NOT NULL
    GROUP BY path
    ORDER BY 2 DESC
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slug', slug,
    'name', COALESCE(p.name, slug),
    'image', p.main_image_url,
    'views', tp.views
  ) ORDER BY tp.views DESC), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT replace(path, '/produto/', '') AS slug, views FROM top_paths
  ) tp
  LEFT JOIN public.products p ON p.slug = tp.slug;

  v_result := jsonb_build_object(
    'totalViews', COALESCE(v_total_views, 0),
    'uniqueVisitors', COALESCE(v_unique, 0),
    'returningVisitors', COALESCE(v_returning, 0),
    'newVisitors', COALESCE(v_new, 0),
    'dailyTrend', v_daily,
    'trafficSources', v_sources,
    'trafficMediums', v_mediums,
    'topReferrerDomains', v_domains,
    'topCampaigns', v_campaigns,
    'deviceBreakdown', v_devices,
    'topProducts', v_products
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_visits_summary(integer) TO authenticated;

-- ==========================================================================
-- dashboard_order_analytics
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.dashboard_order_analytics(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz;
  v_catalog_items bigint;
  v_catalog_revenue bigint;
  v_pp_items bigint;
  v_pp_revenue bigint;
  v_unknown_items bigint;
  v_unknown_revenue bigint;
  v_total_items bigint;
  v_unique_orders bigint;
  v_top_catalog jsonb;
  v_top_pp jsonb;
  v_daily jsonb;
BEGIN
  IF NOT public.is_admin_or_seller(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_since := now() - make_interval(days => GREATEST(p_days, 1));

  -- Materializa itens válidos apenas uma vez
  CREATE TEMP TABLE IF NOT EXISTS _oa_items ON COMMIT DROP AS
  SELECT
    oi.id AS item_id,
    oi.qty,
    oi.line_total_cents,
    oi.added_from,
    oi.created_at,
    o.id AS order_id,
    o.customer_id,
    o.customer_name,
    o.customer_whatsapp,
    o.status
  FROM public.order_intent_items oi
  JOIN public.order_intents o ON o.id = oi.order_intent_id
  WHERE oi.created_at >= v_since
    AND o.status <> 'CANCELADO';

  -- Métricas por origem
  SELECT
    COALESCE(SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from NOT IN ('catalog','product_page') OR added_from IS NULL THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from NOT IN ('catalog','product_page') OR added_from IS NULL THEN line_total_cents ELSE 0 END), 0),
    COUNT(DISTINCT order_id)
  INTO v_catalog_items, v_catalog_revenue, v_pp_items, v_pp_revenue, v_unknown_items, v_unknown_revenue, v_unique_orders
  FROM _oa_items;

  v_total_items := v_catalog_items + v_pp_items + v_unknown_items;

  -- Top clientes (catalog)
  WITH per_customer AS (
    SELECT
      COALESCE(customer_id::text, customer_whatsapp) AS key,
      MAX(customer_id::text)      AS customer_id,
      MAX(customer_name)          AS customer_name,
      MAX(customer_whatsapp)      AS customer_whatsapp,
      SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END) AS catalog_items,
      SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END) AS pp_items,
      SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END) AS catalog_rev,
      SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END) AS pp_rev
    FROM _oa_items
    WHERE customer_id IS NOT NULL OR customer_whatsapp IS NOT NULL
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'customerId', customer_id,
    'customerName', customer_name,
    'customerWhatsapp', customer_whatsapp,
    'totalOrders', 0,
    'catalogItems', catalog_items,
    'productPageItems', pp_items,
    'catalogRevenue', catalog_rev,
    'productPageRevenue', pp_rev,
    'preferredSource', CASE
      WHEN catalog_items > pp_items * 2 THEN 'catalog'
      WHEN pp_items > catalog_items * 2 THEN 'product_page'
      ELSE 'mixed' END
  ) ORDER BY catalog_items DESC), '[]'::jsonb)
  INTO v_top_catalog
  FROM (SELECT * FROM per_customer WHERE catalog_items > 0 ORDER BY catalog_items DESC LIMIT 5) t;

  -- Top clientes (product_page)
  WITH per_customer AS (
    SELECT
      COALESCE(customer_id::text, customer_whatsapp) AS key,
      MAX(customer_id::text)      AS customer_id,
      MAX(customer_name)          AS customer_name,
      MAX(customer_whatsapp)      AS customer_whatsapp,
      SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END) AS catalog_items,
      SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END) AS pp_items,
      SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END) AS catalog_rev,
      SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END) AS pp_rev
    FROM _oa_items
    WHERE customer_id IS NOT NULL OR customer_whatsapp IS NOT NULL
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'customerId', customer_id,
    'customerName', customer_name,
    'customerWhatsapp', customer_whatsapp,
    'totalOrders', 0,
    'catalogItems', catalog_items,
    'productPageItems', pp_items,
    'catalogRevenue', catalog_rev,
    'productPageRevenue', pp_rev,
    'preferredSource', CASE
      WHEN catalog_items > pp_items * 2 THEN 'catalog'
      WHEN pp_items > catalog_items * 2 THEN 'product_page'
      ELSE 'mixed' END
  ) ORDER BY pp_items DESC), '[]'::jsonb)
  INTO v_top_pp
  FROM (SELECT * FROM per_customer WHERE pp_items > 0 ORDER BY pp_items DESC LIMIT 5) t;

  -- Tendência dos últimos 7 dias
  WITH days AS (
    SELECT generate_series((now() - interval '6 days')::date, now()::date, interval '1 day')::date AS d
  ),
  agg AS (
    SELECT created_at::date AS d,
      SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END) AS catalog_items,
      SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END) AS pp_items,
      SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END) AS catalog_rev,
      SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END) AS pp_rev
    FROM _oa_items
    WHERE created_at >= (now() - interval '7 days')
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(days.d, 'YYYY-MM-DD'),
    'catalogItems', COALESCE(agg.catalog_items, 0),
    'productPageItems', COALESCE(agg.pp_items, 0),
    'catalogRevenue', COALESCE(agg.catalog_rev, 0),
    'productPageRevenue', COALESCE(agg.pp_rev, 0)
  ) ORDER BY days.d), '[]'::jsonb)
  INTO v_daily
  FROM days LEFT JOIN agg ON agg.d = days.d;

  DROP TABLE IF EXISTS _oa_items;

  RETURN jsonb_build_object(
    'totalOrders', v_unique_orders,
    'totalItems', v_total_items,
    'totalRevenue', v_catalog_revenue + v_pp_revenue + v_unknown_revenue,
    'catalogItems', v_catalog_items,
    'catalogRevenue', v_catalog_revenue,
    'productPageItems', v_pp_items,
    'productPageRevenue', v_pp_revenue,
    'unknownItems', v_unknown_items,
    'unknownRevenue', v_unknown_revenue,
    'catalogPercentage', CASE WHEN v_total_items > 0 THEN ROUND((v_catalog_items::numeric / v_total_items) * 100) ELSE 0 END,
    'productPagePercentage', CASE WHEN v_total_items > 0 THEN ROUND((v_pp_items::numeric / v_total_items) * 100) ELSE 0 END,
    'topCatalogCustomers', v_top_catalog,
    'topProductPageCustomers', v_top_pp,
    'dailyTrend', v_daily
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_order_analytics(integer) TO authenticated;
