import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerOrder {
  id: string;
  order_number: number | null;
  status: string;
  total_cents: number;
  created_at: string;
  item_count: number;
}

export interface Customer {
  id: string;
  name: string | null;
  whatsapp: string;
  created_at: string;
  updated_at: string;
  order_count: number;
  total_spent: number;
  orders: CustomerOrder[];
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;

      async function fetchAll<T>(
        build: (from: number, to: number) => any
      ): Promise<T[]> {
        const all: T[] = [];
        for (let i = 0; i < 200; i++) {
          const from = i * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data, error } = await build(from, to);
          if (error) throw error;
          const batch = (data ?? []) as T[];
          all.push(...batch);
          if (batch.length < PAGE_SIZE) break;
        }
        return all;
      }

      const customers = await fetchAll<any>((from, to) =>
        supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      const orders = await fetchAll<any>((from, to) =>
        supabase
          .from('order_intents')
          .select('id, customer_id, total_cents, order_number, status, created_at')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      const items = await fetchAll<any>((from, to) =>
        supabase
          .from('order_intent_items')
          .select('order_intent_id, qty')
          .range(from, to)
      );

      const itemCountMap = new Map<string, number>();
      items?.forEach(item => {
        const current = itemCountMap.get(item.order_intent_id) || 0;
        itemCountMap.set(item.order_intent_id, current + item.qty);
      });

      // Group orders by customer
      const ordersByCustomer = new Map<string, CustomerOrder[]>();
      const orderStats = new Map<string, { count: number; total: number }>();

      orders?.forEach(order => {
        if (order.customer_id) {
          const customerOrders = ordersByCustomer.get(order.customer_id) || [];
          customerOrders.push({
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total_cents: order.total_cents,
            created_at: order.created_at,
            item_count: itemCountMap.get(order.id) || 0,
          });
          ordersByCustomer.set(order.customer_id, customerOrders);

          const current = orderStats.get(order.customer_id) || { count: 0, total: 0 };
          orderStats.set(order.customer_id, {
            count: current.count + 1,
            total: current.total + (order.total_cents || 0),
          });
        }
      });

      // Sort each customer's orders by date desc
      ordersByCustomer.forEach((customerOrders) => {
        customerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      const customersWithStats: Customer[] = (customers || []).map(c => ({
        ...c,
        order_count: orderStats.get(c.id)?.count || 0,
        total_spent: orderStats.get(c.id)?.total || 0,
        orders: ordersByCustomer.get(c.id) || [],
      }));

      return customersWithStats;
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('customers')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
