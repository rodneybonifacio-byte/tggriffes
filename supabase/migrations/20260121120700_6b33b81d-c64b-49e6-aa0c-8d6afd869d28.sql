-- Tabela para rastrear reservas de carrinho (estoque reservado antes do pedido)
CREATE TABLE public.cart_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL, -- ID anônimo do navegador
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cart_reservations_session ON public.cart_reservations(session_id);
CREATE INDEX idx_cart_reservations_variant ON public.cart_reservations(variant_id);
CREATE INDEX idx_cart_reservations_expires ON public.cart_reservations(expires_at);

-- Habilitar RLS
ALTER TABLE public.cart_reservations ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer um pode criar/ver/deletar suas próprias reservas (baseado em session_id passado)
CREATE POLICY "Anyone can insert cart reservations"
ON public.cart_reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view cart reservations"
ON public.cart_reservations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can delete cart reservations"
ON public.cart_reservations
FOR DELETE
USING (true);

CREATE POLICY "Anyone can update cart reservations"
ON public.cart_reservations
FOR UPDATE
USING (true);

-- Admins podem ver todas para gestão
CREATE POLICY "Admins can view all cart reservations"
ON public.cart_reservations
FOR SELECT
USING (is_admin_or_seller(auth.uid()));

-- Função para decrementar estoque ao criar reserva
CREATE OR REPLACE FUNCTION public.decrement_stock_on_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE product_variants
  SET stock_qty = stock_qty - NEW.quantity
  WHERE id = NEW.variant_id;
  RETURN NEW;
END;
$$;

-- Função para restaurar estoque ao deletar reserva
CREATE OR REPLACE FUNCTION public.restore_stock_on_reservation_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE product_variants
  SET stock_qty = stock_qty + OLD.quantity
  WHERE id = OLD.variant_id;
  RETURN OLD;
END;
$$;

-- Função para ajustar estoque ao atualizar quantidade da reserva
CREATE OR REPLACE FUNCTION public.adjust_stock_on_reservation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  qty_diff INTEGER;
BEGIN
  qty_diff := NEW.quantity - OLD.quantity;
  IF qty_diff != 0 THEN
    UPDATE product_variants
    SET stock_qty = stock_qty - qty_diff
    WHERE id = NEW.variant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER decrement_stock_on_reservation_insert
AFTER INSERT ON public.cart_reservations
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_reservation();

CREATE TRIGGER restore_stock_on_reservation_delete
AFTER DELETE ON public.cart_reservations
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_reservation_delete();

CREATE TRIGGER adjust_stock_on_reservation_update
AFTER UPDATE OF quantity ON public.cart_reservations
FOR EACH ROW
EXECUTE FUNCTION public.adjust_stock_on_reservation_update();