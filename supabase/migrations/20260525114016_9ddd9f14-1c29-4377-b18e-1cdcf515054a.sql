-- 1. Coluna pré-agregada
ALTER TABLE public.order_intents
  ADD COLUMN IF NOT EXISTS items_count integer NOT NULL DEFAULT 0;

-- 2. Backfill
UPDATE public.order_intents oi
SET items_count = sub.c
FROM (
  SELECT order_intent_id, COUNT(*)::int AS c
  FROM public.order_intent_items
  GROUP BY order_intent_id
) sub
WHERE oi.id = sub.order_intent_id;

-- 3. Trigger de manutenção
CREATE OR REPLACE FUNCTION public.sync_order_items_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.order_intents
      SET items_count = items_count + 1
      WHERE id = NEW.order_intent_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.order_intents
      SET items_count = GREATEST(items_count - 1, 0)
      WHERE id = OLD.order_intent_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.order_intent_id <> OLD.order_intent_id THEN
    UPDATE public.order_intents SET items_count = GREATEST(items_count - 1, 0) WHERE id = OLD.order_intent_id;
    UPDATE public.order_intents SET items_count = items_count + 1 WHERE id = NEW.order_intent_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_items_count ON public.order_intent_items;
CREATE TRIGGER trg_sync_order_items_count
AFTER INSERT OR UPDATE OR DELETE ON public.order_intent_items
FOR EACH ROW EXECUTE FUNCTION public.sync_order_items_count();

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_order_intents_created_at ON public.order_intents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_intent_items_order_intent_id ON public.order_intent_items (order_intent_id);
CREATE INDEX IF NOT EXISTS idx_order_intents_status ON public.order_intents (status);