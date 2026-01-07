-- Allow admins to update order items
CREATE POLICY "Admins can update order items" 
ON public.order_intent_items 
FOR UPDATE 
USING (is_admin_or_seller(auth.uid()));

-- Allow admins to delete order items
CREATE POLICY "Admins can delete order items" 
ON public.order_intent_items 
FOR DELETE 
USING (is_admin_or_seller(auth.uid()));