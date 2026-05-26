
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referrer_domain text,
  ADD COLUMN IF NOT EXISTS traffic_medium text,
  ADD COLUMN IF NOT EXISTS device_type text;

CREATE INDEX IF NOT EXISTS idx_page_views_referrer_domain ON public.page_views(referrer_domain) WHERE referrer_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_utm_campaign ON public.page_views(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_traffic_medium ON public.page_views(traffic_medium);
