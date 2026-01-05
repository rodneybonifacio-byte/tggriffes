-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can create order intents" ON public.order_intents;

-- Create a permissive INSERT policy (default behavior)
CREATE POLICY "Anyone can create order intents" 
ON public.order_intents 
FOR INSERT 
TO public
WITH CHECK (true);

-- Also fix the order_intent_items table
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_intent_items;

CREATE POLICY "Anyone can create order items" 
ON public.order_intent_items 
FOR INSERT 
TO public
WITH CHECK (true);