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
    queryKey: ['order-intents', 'v2-paginated'],
    queryFn: async () => {
      // PostgREST cap a 1000 linhas por request — paginamos.
      // Buscamos os pedidos SEM o join de itens (mais leve e evita cap embutido),
      // e depois carregamos os itens em lotes por order_intent_id.
      const PAGE_SIZE = 1000;
      const orders: Tables<'order_intents'>[] = [];
      for (let i = 0; i < 50; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intents')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = data ?? [];
        orders.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      // Carrega itens em lotes (in() por chunks de IDs)
      const itemsByOrder = new Map<string, Tables<'order_intent_items'>[]>();
      const ids = orders.map(o => o.id);
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        // paginar dentro do chunk também, por segurança
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('order_intent_items')
            .select('*')
            .in('order_intent_id', chunk)
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          const batch = data ?? [];
          for (const it of batch) {
            const arr = itemsByOrder.get(it.order_intent_id) ?? [];
            arr.push(it);
            itemsByOrder.set(it.order_intent_id, arr);
          }
          if (batch.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      return orders.map(o => ({
        ...o,
        order_intent_items: itemsByOrder.get(o.id) ?? [],
      })) as OrderIntent[];
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
