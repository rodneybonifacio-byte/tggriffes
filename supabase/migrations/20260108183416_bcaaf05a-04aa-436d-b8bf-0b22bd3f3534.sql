-- Tabela de clientes
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  whatsapp text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view customers"
ON public.customers FOR SELECT
USING (is_admin_or_seller(auth.uid()));

CREATE POLICY "Anyone can insert customers"
ON public.customers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
USING (is_admin_or_seller(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar customer_id na order_intents
ALTER TABLE public.order_intents
ADD COLUMN customer_id uuid REFERENCES public.customers(id);

-- Function para criar/buscar cliente e retornar ID
CREATE OR REPLACE FUNCTION public.upsert_customer(p_name text, p_whatsapp text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Tenta encontrar cliente existente pelo whatsapp
  SELECT id INTO v_customer_id
  FROM customers
  WHERE whatsapp = p_whatsapp;
  
  IF v_customer_id IS NULL THEN
    -- Cria novo cliente
    INSERT INTO customers (name, whatsapp)
    VALUES (p_name, p_whatsapp)
    RETURNING id INTO v_customer_id;
  ELSE
    -- Atualiza nome se fornecido
    IF p_name IS NOT NULL AND p_name != '' THEN
      UPDATE customers
      SET name = p_name
      WHERE id = v_customer_id;
    END IF;
  END IF;
  
  RETURN v_customer_id;
END;
$$;