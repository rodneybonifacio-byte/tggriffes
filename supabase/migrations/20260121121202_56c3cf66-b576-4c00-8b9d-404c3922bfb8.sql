-- Ao converter reservas em pedido, precisamos deletar as reservas SEM restaurar o estoque
-- Pois o pedido vai consumir o mesmo estoque
-- Para isso, criamos uma função especial que deleta reservas sem trigger

CREATE OR REPLACE FUNCTION public.convert_reservations_to_order(p_session_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Desabilita temporariamente o trigger de restauração ao deletar
  -- Deletando diretamente com bypass do trigger através de uma tabela temporária
  
  -- Primeiro, guardamos os IDs das reservas
  CREATE TEMP TABLE IF NOT EXISTS temp_reservation_ids (id UUID);
  DELETE FROM temp_reservation_ids; -- Limpa se existir
  
  INSERT INTO temp_reservation_ids
  SELECT cr.id FROM cart_reservations cr WHERE cr.session_id = p_session_id;
  
  -- Agora deletamos as reservas, mas como os itens do pedido já vão consumir o estoque,
  -- precisamos RESTAURAR o estoque das reservas ANTES do pedido ser criado
  -- para que o trigger do pedido decremente corretamente
  
  -- Na verdade, a lógica correta é:
  -- 1. Reserva decrementa estoque ao ser criada ✓
  -- 2. Ao finalizar pedido, deletamos a reserva (restaura estoque)
  -- 3. Criamos o item do pedido (decrementa estoque novamente)
  -- Resultado: estoque fica correto
  
  -- Então não precisamos de lógica especial, o fluxo padrão já funciona!
  -- Basta deletar as reservas normalmente
  
  DELETE FROM cart_reservations WHERE session_id = p_session_id;
  
  DROP TABLE IF EXISTS temp_reservation_ids;
END;
$$;