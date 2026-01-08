import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Customer {
  id: string;
  name: string | null;
  whatsapp: string;
  created_at: string;
  updated_at: string;
  order_count: number;
  total_spent: number;
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      // Buscar clientes
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // Buscar pedidos para contar por cliente
      const { data: orders, error: ordersError } = await supabase
        .from('order_intents')
        .select('customer_id, total_cents');

      if (ordersError) throw ordersError;

      // Mapear contagem de pedidos e total gasto por cliente
      const orderStats = new Map<string, { count: number; total: number }>();
      orders?.forEach(order => {
        if (order.customer_id) {
          const current = orderStats.get(order.customer_id) || { count: 0, total: 0 };
          orderStats.set(order.customer_id, {
            count: current.count + 1,
            total: current.total + (order.total_cents || 0),
          });
        }
      });

      // Combinar dados
      const customersWithStats: Customer[] = (customers || []).map(c => ({
        ...c,
        order_count: orderStats.get(c.id)?.count || 0,
        total_spent: orderStats.get(c.id)?.total || 0,
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
