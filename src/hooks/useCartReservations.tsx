import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect, useState } from 'react';

const SESSION_ID_KEY = 'tg-cart-session-id';

// Gerar ou recuperar ID de sessão
const getSessionId = (): string => {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
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
  });
}

// Hook para criar reserva
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  
  return useMutation({
    mutationFn: async (params: CreateReservationParams) => {
      // Verificar estoque disponível
      const { data: variant, error: variantError } = await supabase
        .from('product_variants')
        .select('stock_qty')
        .eq('id', params.variantId)
        .single();
      
      if (variantError) throw variantError;
      if (variant.stock_qty < params.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${variant.stock_qty}`);
      }
      
      // Verificar se já existe reserva para esta variante nesta sessão
      const { data: existing } = await supabase
        .from('cart_reservations')
        .select('id, quantity')
        .eq('session_id', sessionId)
        .eq('variant_id', params.variantId)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (existing) {
        // Atualizar quantidade existente
        const newQty = existing.quantity + params.quantity;
        if (variant.stock_qty < params.quantity) {
          throw new Error(`Estoque insuficiente para adicionar mais ${params.quantity}`);
        }
        
        const { error } = await supabase
          .from('cart_reservations')
          .update({ 
            quantity: newQty,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          })
          .eq('id', existing.id);
        
        if (error) throw error;
        return { updated: true, id: existing.id };
      }
      
      // Criar nova reserva
      const { data, error } = await supabase
        .from('cart_reservations')
        .insert({
          session_id: sessionId,
          variant_id: params.variantId,
          product_id: params.productId,
          product_name: params.productName,
          size: params.size,
          color: params.color,
          quantity: params.quantity,
          unit_price_cents: params.unitPriceCents,
          image_url: params.imageUrl,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { created: true, data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para atualizar quantidade de reserva
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para deletar reserva
export function useDeleteReservation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cart_reservations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-reservations'] });
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
