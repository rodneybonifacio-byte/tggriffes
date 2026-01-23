import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SESSION_ID_KEY = 'tg-cart-session-id';

// Gerar ou recuperar ID de sessão (cached)
let cachedSessionId: string | null = null;
const getSessionId = (): string => {
  if (cachedSessionId) return cachedSessionId;
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  cachedSessionId = sessionId;
  return sessionId;
};

export interface CartReservation {
  id: string;
  session_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  size: string;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  image_url: string | null;
  reserved_at: string;
  expires_at: string;
}

export interface CreateReservationParams {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  color: string | null;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
}

// Hook para buscar reservas da sessão atual
export function useMyCartReservations() {
  const sessionId = getSessionId();
  
  return useQuery({
    queryKey: ['cart-reservations', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cart_reservations')
        .select('*')
        .eq('session_id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CartReservation[];
    },
    staleTime: 30000, // 30s - reduz re-fetches
    gcTime: 60000, // 1 min cache
  });
}

// Hook para criar reserva usando RPC atômica (valida estoque com lock)
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  
  return useMutation({
    mutationFn: async (params: CreateReservationParams) => {
      // Usa RPC atômica que valida estoque em tempo real com lock
      const { data, error } = await supabase.rpc('add_cart_reservation', {
        p_session_id: sessionId,
        p_variant_id: params.variantId,
        p_product_id: params.productId,
        p_product_name: params.productName,
        p_size: params.size,
        p_color: params.color,
        p_quantity: params.quantity,
        p_unit_price_cents: params.unitPriceCents,
        p_image_url: params.imageUrl,
      });
      
      if (error) {
        // Traduz mensagens de erro do banco
        if (error.message.includes('Estoque insuficiente')) {
          throw new Error('Estoque insuficiente');
        }
        throw error;
      }
      
      return { created: true, data };
    },
    // Optimistic update para resposta instantânea
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['cart-reservations', sessionId] });
      const previous = queryClient.getQueryData<CartReservation[]>(['cart-reservations', sessionId]);
      
      queryClient.setQueryData<CartReservation[]>(['cart-reservations', sessionId], (old = []) => {
        const existing = old.find(r => r.variant_id === params.variantId);
        if (existing) {
          return old.map(r => 
            r.variant_id === params.variantId 
              ? { ...r, quantity: r.quantity + params.quantity }
              : r
          );
        }
        return [...old, {
          id: `temp-${Date.now()}`,
          session_id: sessionId,
          variant_id: params.variantId,
          product_id: params.productId,
          product_name: params.productName,
          size: params.size,
          color: params.color,
          quantity: params.quantity,
          unit_price_cents: params.unitPriceCents,
          image_url: params.imageUrl,
          reserved_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }];
      });
      
      return { previous };
    },
    onError: (err, params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart-reservations', sessionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations', sessionId] });
      // Também invalida produtos para atualizar contadores de estoque
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para atualizar quantidade de reserva com optimistic update
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('cart_reservations')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return { deleted: true };
      }
      
      const { error } = await supabase
        .from('cart_reservations')
        .update({ 
          quantity,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      return { updated: true };
    },
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['cart-reservations', sessionId] });
      const previous = queryClient.getQueryData<CartReservation[]>(['cart-reservations', sessionId]);
      
      queryClient.setQueryData<CartReservation[]>(['cart-reservations', sessionId], (old = []) => {
        if (quantity <= 0) {
          return old.filter(r => r.id !== id);
        }
        return old.map(r => r.id === id ? { ...r, quantity } : r);
      });
      
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart-reservations', sessionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations', sessionId] });
      // Atualiza estoque nos cards de produto imediatamente
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para deletar reserva com optimistic update
export function useDeleteReservation() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cart_reservations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['cart-reservations', sessionId] });
      const previous = queryClient.getQueryData<CartReservation[]>(['cart-reservations', sessionId]);
      
      queryClient.setQueryData<CartReservation[]>(['cart-reservations', sessionId], (old = []) => 
        old.filter(r => r.id !== id)
      );
      
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart-reservations', sessionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations', sessionId] });
      // Atualiza estoque nos cards de produto imediatamente
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para limpar todas reservas da sessão (após finalizar pedido)
export function useClearSessionReservations() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('cart_reservations')
        .delete()
        .eq('session_id', sessionId);
      
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['cart-reservations', sessionId] });
      const previous = queryClient.getQueryData<CartReservation[]>(['cart-reservations', sessionId]);
      queryClient.setQueryData(['cart-reservations', sessionId], []);
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart-reservations', sessionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations', sessionId] });
      // Atualiza estoque nos cards de produto imediatamente
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para admin: buscar todas as reservas (carrinhos abandonados)
export function useAllCartReservations() {
  return useQuery({
    queryKey: ['all-cart-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cart_reservations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CartReservation[];
    },
  });
}

// Hook para admin: limpar reservas expiradas manualmente
export function useCleanupExpiredReservations() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cleanup-expired-reservations');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-cart-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['cart-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Utilitário para obter o session ID
export function useSessionId() {
  return getSessionId();
}
