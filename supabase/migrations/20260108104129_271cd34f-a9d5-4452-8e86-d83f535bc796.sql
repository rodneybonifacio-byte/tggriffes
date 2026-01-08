-- Função para decrementar estoque quando um pedido é criado
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrementa o estoque da variante
  UPDATE product_variants
  SET stock_qty = stock_qty - NEW.qty
  WHERE id = NEW.variant_id;
  
  RETURN NEW;
END;
$$;

-- Função para restaurar estoque quando pedido é cancelado
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o status mudou para CANCELADO
  IF NEW.status = 'CANCELADO' AND OLD.status != 'CANCELADO' THEN
    -- Restaura o estoque de todos os itens do pedido
    UPDATE product_variants pv
    SET stock_qty = pv.stock_qty + oi.qty
    FROM order_intent_items oi
    WHERE oi.order_intent_id = NEW.id
      AND oi.variant_id = pv.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para decrementar estoque ao inserir item de pedido
CREATE TRIGGER trigger_decrement_stock_on_order_item
AFTER INSERT ON order_intent_items
FOR EACH ROW
EXECUTE FUNCTION decrement_stock_on_order_item();

-- Trigger para restaurar estoque ao cancelar pedido
CREATE TRIGGER trigger_restore_stock_on_cancel
AFTER UPDATE ON order_intents
FOR EACH ROW
EXECUTE FUNCTION restore_stock_on_cancel();