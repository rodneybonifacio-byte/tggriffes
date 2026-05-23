import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type OrderIntent = Tables<'order_intents'> & {
  order_intent_items?: Tables<'order_intent_items'>[];
};

export interface OrderHistoryEntry {
  id: string;
  order_intent_id: string;
  user_id: string | null;
  action: string;
  description: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export function useOrderIntents() {
  return useQuery({
    queryKey: ['order-intents'],
    queryFn: async () => {
      // Supabase limita 1000 linhas por query — paginamos para trazer tudo
      const PAGE_SIZE = 1000;
      let from = 0;
      const all: OrderIntent[] = [];
      // safety cap to avoid infinite loop
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from('order_intents')
          .select(`
            *,
            order_intent_items(*)
          `)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = (data ?? []) as OrderIntent[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
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

// Order History hooks
export function useOrderHistory(orderIntentId: string | null) {
  return useQuery({
    queryKey: ['order-history', orderIntentId],
    queryFn: async () => {
      if (!orderIntentId) return [];
      
      // Direct query - cast to any to bypass type checking for newly created table
      const response = await (supabase as unknown as { from: (table: string) => { 
        select: (cols: string) => { 
          eq: (col: string, val: string) => { 
            order: (col: string, opts: { ascending: boolean }) => Promise<{ data: OrderHistoryEntry[] | null; error: Error | null }> 
          } 
        } 
      }}).from('order_history')
        .select('*')
        .eq('order_intent_id', orderIntentId)
        .order('created_at', { ascending: false });
      
      if (response.error) throw response.error;
      return response.data || [];
    },
    enabled: !!orderIntentId,
  });
}

export function useAddOrderHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entry: {
      order_intent_id: string;
      action: string;
      description: string;
      changes?: Record<string, unknown>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Direct insert - cast to any to bypass type checking for newly created table
      const response = await (supabase as unknown as { from: (table: string) => { 
        insert: (data: unknown) => Promise<{ error: Error | null }> 
      }}).from('order_history')
        .insert({
          order_intent_id: entry.order_intent_id,
          user_id: user?.id || null,
          action: entry.action,
          description: entry.description,
          changes: entry.changes || null,
        });
      
      if (response.error) throw response.error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order-history', variables.order_intent_id] });
    },
  });
}
