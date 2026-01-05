-- Create a function to get the next order number
CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('order_number_seq')::INTEGER;
$$;