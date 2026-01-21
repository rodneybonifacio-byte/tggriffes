-- Add email column to customers table for linking with auth users
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- Allow customers to view their own customer record
CREATE POLICY "Customers can view own customer record" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow customers to update their own customer record (name and whatsapp)
CREATE POLICY "Customers can update own customer record" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow customers to view their own orders
CREATE POLICY "Customers can view their own orders" 
ON public.order_intents 
FOR SELECT 
TO authenticated
USING (
  customer_id IN (
    SELECT c.id FROM customers c 
    WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Allow customers to view their own order items
CREATE POLICY "Customers can view their own order items" 
ON public.order_intent_items 
FOR SELECT 
TO authenticated
USING (
  order_intent_id IN (
    SELECT oi.id FROM order_intents oi
    INNER JOIN customers c ON c.id = oi.customer_id
    WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);