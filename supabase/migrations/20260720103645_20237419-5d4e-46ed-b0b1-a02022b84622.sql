
-- Fix ambiguity in top products query
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

  SELECT COUNT(*), COUNT(DISTINCT visitor_id)
  INTO v_total_views, v_unique
  FROM public.page_views pv
  WHERE pv.created_at >= v_since
    AND (pv.referrer_domain IS NULL OR lower(pv.referrer_domain) NOT LIKE '%lovable%');

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

  WITH src AS (
    SELECT COALESCE(NULLIF(traffic_source, ''), 'direct') AS source, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM src)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', source, 'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb) INTO v_sources FROM src;

  WITH med AS (
    SELECT COALESCE(NULLIF(traffic_medium, ''), 'direct') AS medium, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM med)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'medium', medium, 'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb) INTO v_mediums FROM med;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('domain', domain, 'views', views) ORDER BY views DESC), '[]'::jsonb)
  INTO v_domains
  FROM (
    SELECT referrer_domain AS domain, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND referrer_domain IS NOT NULL
      AND lower(referrer_domain) NOT LIKE '%lovable%'
      AND lower(referrer_domain) <> 'localhost'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('campaign', campaign, 'views', views) ORDER BY views DESC), '[]'::jsonb)
  INTO v_campaigns
  FROM (
    SELECT utm_campaign AS campaign, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND utm_campaign IS NOT NULL
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1 ORDER BY 2 DESC LIMIT 6
  ) t;

  WITH dev AS (
    SELECT COALESCE(NULLIF(device_type, ''), 'unknown') AS device, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
    GROUP BY 1
  ), total AS (SELECT NULLIF(SUM(views), 0) AS t FROM dev)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'device', device, 'views', views,
    'percentage', ROUND((views::numeric / COALESCE((SELECT t FROM total), 1)) * 100)
  ) ORDER BY views DESC), '[]'::jsonb) INTO v_devices FROM dev;

  WITH top_paths AS (
    SELECT path, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
      AND page_type = 'product'
      AND (referrer_domain IS NULL OR lower(referrer_domain) NOT LIKE '%lovable%')
      AND path IS NOT NULL
    GROUP BY path ORDER BY 2 DESC LIMIT 10
  ),
  tp AS (
    SELECT replace(path, '/produto/', '') AS tp_slug, views FROM top_paths
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slug', tp.tp_slug,
    'name', COALESCE(p.name, tp.tp_slug),
    'image', p.main_image_url,
    'views', tp.views
  ) ORDER BY tp.views DESC), '[]'::jsonb)
  INTO v_products
  FROM tp LEFT JOIN public.products p ON p.slug = tp.tp_slug;

  RETURN jsonb_build_object(
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
END;
$$;

-- Reescreve order analytics sem temp table (STABLE não permite CREATE TABLE)
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

  WITH items AS (
    SELECT
      oi.qty, oi.line_total_cents, oi.added_from, oi.created_at,
      o.id AS order_id, o.customer_id, o.customer_name, o.customer_whatsapp
    FROM public.order_intent_items oi
    JOIN public.order_intents o ON o.id = oi.order_intent_id
    WHERE oi.created_at >= v_since AND o.status <> 'CANCELADO'
  )
  SELECT
    COALESCE(SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from NOT IN ('catalog','product_page') OR added_from IS NULL THEN qty            ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN added_from NOT IN ('catalog','product_page') OR added_from IS NULL THEN line_total_cents ELSE 0 END), 0),
    COUNT(DISTINCT order_id)
  INTO v_catalog_items, v_catalog_revenue, v_pp_items, v_pp_revenue, v_unknown_items, v_unknown_revenue, v_unique_orders
  FROM items;

  v_total_items := v_catalog_items + v_pp_items + v_unknown_items;

  WITH items AS (
    SELECT
      oi.qty, oi.line_total_cents, oi.added_from,
      o.customer_id, o.customer_name, o.customer_whatsapp
    FROM public.order_intent_items oi
    JOIN public.order_intents o ON o.id = oi.order_intent_id
    WHERE oi.created_at >= v_since AND o.status <> 'CANCELADO'
      AND (o.customer_id IS NOT NULL OR o.customer_whatsapp IS NOT NULL)
  ),
  per_customer AS (
    SELECT
      COALESCE(customer_id::text, customer_whatsapp) AS key,
      MAX(customer_id::text) AS customer_id,
      MAX(customer_name) AS customer_name,
      MAX(customer_whatsapp) AS customer_whatsapp,
      SUM(CASE WHEN added_from = 'catalog'      THEN qty            ELSE 0 END) AS catalog_items,
      SUM(CASE WHEN added_from = 'product_page' THEN qty            ELSE 0 END) AS pp_items,
      SUM(CASE WHEN added_from = 'catalog'      THEN line_total_cents ELSE 0 END) AS catalog_rev,
      SUM(CASE WHEN added_from = 'product_page' THEN line_total_cents ELSE 0 END) AS pp_rev
    FROM items GROUP BY 1
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'customerId', customer_id, 'customerName', customer_name, 'customerWhatsapp', customer_whatsapp,
        'totalOrders', 0, 'catalogItems', catalog_items, 'productPageItems', pp_items,
        'catalogRevenue', catalog_rev, 'productPageRevenue', pp_rev,
        'preferredSource', CASE WHEN catalog_items > pp_items * 2 THEN 'catalog'
                                WHEN pp_items > catalog_items * 2 THEN 'product_page'
                                ELSE 'mixed' END
      ) ORDER BY catalog_items DESC)
      FROM (SELECT * FROM per_customer WHERE catalog_items > 0 ORDER BY catalog_items DESC LIMIT 5) t1
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'customerId', customer_id, 'customerName', customer_name, 'customerWhatsapp', customer_whatsapp,
        'totalOrders', 0, 'catalogItems', catalog_items, 'productPageItems', pp_items,
        'catalogRevenue', catalog_rev, 'productPageRevenue', pp_rev,
        'preferredSource', CASE WHEN catalog_items > pp_items * 2 THEN 'catalog'
                                WHEN pp_items > catalog_items * 2 THEN 'product_page'
                                ELSE 'mixed' END
      ) ORDER BY pp_items DESC)
      FROM (SELECT * FROM per_customer WHERE pp_items > 0 ORDER BY pp_items DESC LIMIT 5) t2
    ), '[]'::jsonb)
  INTO v_top_catalog, v_top_pp;

  WITH days AS (
    SELECT generate_series((now() - interval '6 days')::date, now()::date, interval '1 day')::date AS d
  ),
  agg AS (
    SELECT oi.created_at::date AS d,
      SUM(CASE WHEN oi.added_from = 'catalog'      THEN oi.qty            ELSE 0 END) AS catalog_items,
      SUM(CASE WHEN oi.added_from = 'product_page' THEN oi.qty            ELSE 0 END) AS pp_items,
      SUM(CASE WHEN oi.added_from = 'catalog'      THEN oi.line_total_cents ELSE 0 END) AS catalog_rev,
      SUM(CASE WHEN oi.added_from = 'product_page' THEN oi.line_total_cents ELSE 0 END) AS pp_rev
    FROM public.order_intent_items oi
    JOIN public.order_intents o ON o.id = oi.order_intent_id
    WHERE oi.created_at >= (now() - interval '7 days') AND o.status <> 'CANCELADO'
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
