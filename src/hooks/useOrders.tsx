import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type OrderIntent = Tables<'order_intents'> & {
  order_intent_items?: Tables<'order_intent_items'>[];
};

export type OrderIntentSummary = Tables<'order_intents'>;

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
    queryKey: ['order-intents', 'v3'],
    queryFn: async () => {
      // PostgREST limita 1000 linhas por request — paginamos os pedidos.
      const PAGE_SIZE = 1000;
      const all: OrderIntent[] = [];
      for (let i = 0; i < 50; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intents')
          .select(`*, order_intent_items(*)`)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error('[useOrderIntents] erro ao buscar pedidos:', error);
          throw error;
        }
        const batch = (data ?? []) as OrderIntent[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      return all;
    },
  });
}

export function useOrderIntentSummaries() {
  return useQuery({
    queryKey: ['order-intent-summaries', 'paginated-v1'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: OrderIntentSummary[] = [];

      for (let i = 0; i < 50; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intents')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = (data ?? []) as OrderIntentSummary[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return all;
    },
    staleTime: 60 * 1000,
  });
}

export type OrderIntentWithCount = Tables<'order_intents'> & {
  // Coluna pré-agregada mantida por trigger no banco.
  items_count: number;
};

export function useAbandonedOrderIntents() {
  return useQuery({
    queryKey: ['abandoned-order-intents', 'novo-v1'],
    queryFn: async () => {
      const PAGE_SIZE = 500;
      const all: OrderIntent[] = [];

      for (let i = 0; i < 20; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intents')
          .select(`*, order_intent_items(id, qty)`)
          .eq('status', 'NOVO')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('[useAbandonedOrderIntents] erro:', error);
          throw error;
        }

        const batch = (data ?? []) as OrderIntent[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return all;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Lightweight orders list: fetches all order_intents with only the COUNT of items
 * per order (aggregated via PostgREST). Avoids transferring tens of thousands of
 * item rows just to render the admin table.
 */
export function useOrderIntentsLight() {
  return useQuery({
    queryKey: ['order-intents-light', 'v2-items-count'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: OrderIntentWithCount[] = [];
      for (let i = 0; i < 50; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intents')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error('[useOrderIntentsLight] erro:', error);
          throw error;
        }
        const batch = (data ?? []) as unknown as OrderIntentWithCount[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      return all;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Server-side paginated orders list. Pushes status filter and name/phone search
 * to PostgREST so each page returns only `pageSize` rows + an exact total count.
 */
export interface UseOrderIntentsPageParams {
  page: number; // 0-based
  pageSize: number;
  status?: string; // 'all' or specific status
  search?: string; // name or phone substring
}

export function useOrderIntentsPage(params: UseOrderIntentsPageParams) {
  const { page, pageSize, status = 'all', search = '' } = params;
  return useQuery({
    queryKey: ['order-intents-page', 'v2-rpc', { page, pageSize, status, search }],
    queryFn: async () => {
      const from = page * pageSize;

      const { data, error } = await supabase.rpc('search_order_intents', {
        p_status: status,
        p_search: search ?? '',
        p_limit: pageSize,
        p_offset: from,
      });

      if (error) {
        console.error('[useOrderIntentsPage] erro:', error);
        throw error;
      }

      const payload = (data ?? { rows: [], total: 0 }) as {
        rows: OrderIntentWithCount[];
        total: number;
      };
      return { rows: payload.rows ?? [], total: payload.total ?? 0 };
    },
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  });
}

/**
 * Fetches the items for a single order on demand. Used by the detail modal so
 * we don't load every item in the catalog upfront.
 */
export function useOrderIntentItems(orderIntentId: string | null) {
  return useQuery({
    queryKey: ['order-intent-items', orderIntentId],
    queryFn: async () => {
      if (!orderIntentId) return [] as Tables<'order_intent_items'>[];
      const { data, error } = await supabase
        .from('order_intent_items')
        .select('*')
        .eq('order_intent_id', orderIntentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<'order_intent_items'>[];
    },
    enabled: !!orderIntentId,
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
