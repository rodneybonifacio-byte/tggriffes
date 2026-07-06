CREATE INDEX IF NOT EXISTS idx_order_intents_status_created_at
ON public.order_intents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created_at
ON public.page_views (visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_intent_items_order_created_at
ON public.order_intent_items (order_intent_id, created_at ASC);

ANALYZE public.order_intents;
ANALYZE public.page_views;
ANALYZE public.order_intent_items;