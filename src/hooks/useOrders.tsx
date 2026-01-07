import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type OrderIntent = Tables<'order_intents'> & {
  order_intent_items?: Tables<'order_intent_items'>[];
};

export function useOrderIntents() {
  return useQuery({
    queryKey: ['order-intents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_intents')
        .select(`
          *,
          order_intent_items(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OrderIntent[];
    },
  });
}

export function useCreateOrderIntent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: TablesInsert<'order_intents'>) => {
      const { data, error } = await supabase
        .from('order_intents')
        .insert(order)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}

export function useCreateOrderIntentItem() {
  return useMutation({
    mutationFn: async (item: TablesInsert<'order_intent_items'>) => {
      const { data, error } = await supabase
        .from('order_intent_items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('order_intents')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}

export function useUpdateOrderIntent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      observations,
      subtotal_cents,
      shipping_price_cents,
      total_cents,
      customer_name,
      customer_whatsapp,
      dest_cep,
      shipping_service,
      shipping_deadline_days,
    }: TablesUpdate<'order_intents'> & { id: string }) => {
      const { error } = await supabase
        .from('order_intents')
        .update({ 
          observations, 
          subtotal_cents, 
          shipping_price_cents, 
          total_cents,
          customer_name,
          customer_whatsapp,
          dest_cep,
          shipping_service,
          shipping_deadline_days,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}

export function useDeleteOrderItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('order_intent_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}

export function useUpdateOrderItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      qty, 
      unit_price_cents, 
      line_total_cents 
    }: { 
      id: string; 
      qty: number; 
      unit_price_cents: number; 
      line_total_cents: number;
    }) => {
      const { error } = await supabase
        .from('order_intent_items')
        .update({ qty, unit_price_cents, line_total_cents })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: TablesInsert<'order_intent_items'>) => {
      const { data, error } = await supabase
        .from('order_intent_items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-intents'] });
    },
  });
}
