-- Fix customer RLS policies: do NOT query auth.users inside policies

-- customers
DROP POLICY IF EXISTS "Customers can view own customer record" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own customer record" ON public.customers;

CREATE POLICY "Customers can view own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Customers can update own customer record"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
)
WITH CHECK (
  email = (auth.jwt() ->> 'email')
);

-- order_intents
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.order_intents;

CREATE POLICY "Customers can view their own orders"
ON public.order_intents
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT c.id
    FROM public.customers c
    WHERE c.email = (auth.jwt() ->> 'email')
  )
);

-- order_intent_items
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_intent_items;

CREATE POLICY "Customers can view their own order items"
ON public.order_intent_items
FOR SELECT
TO authenticated
USING (
  order_intent_id IN (
    SELECT oi.id
    FROM public.order_intents oi
    JOIN public.customers c ON c.id = oi.customer_id
    WHERE c.email = (auth.jwt() ->> 'email')
  )
);