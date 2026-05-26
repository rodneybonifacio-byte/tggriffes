import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderSourceAnalytics {
  // Métricas gerais
  totalOrders: number;
  totalItems: number;
  totalRevenue: number;
  
  // Métricas por origem
  catalogItems: number;
  catalogRevenue: number;
  productPageItems: number;
  productPageRevenue: number;
  unknownItems: number;
  unknownRevenue: number;
  
  // Percentuais
  catalogPercentage: number;
  productPagePercentage: number;
  
  // Top clientes por comportamento
  topCatalogCustomers: CustomerBehavior[];
  topProductPageCustomers: CustomerBehavior[];
  
  // Tendência (últimos 7 dias)
  dailyTrend: DailyTrend[];
}

export interface CustomerBehavior {
  customerId: string | null;
  customerName: string | null;
  customerWhatsapp: string | null;
  totalOrders: number;
  catalogItems: number;
  productPageItems: number;
  catalogRevenue: number;
  productPageRevenue: number;
  preferredSource: 'catalog' | 'product_page' | 'mixed';
}

export interface DailyTrend {
  date: string;
  catalogItems: number;
  productPageItems: number;
  catalogRevenue: number;
  productPageRevenue: number;
}

export function useOrderAnalytics() {
  return useQuery({
    queryKey: ['order-analytics', 'paginated-v1'],
    queryFn: async (): Promise<OrderSourceAnalytics> => {
      // PostgREST retorna no máximo 1000 linhas por request.
      // Este relatório precisa de TODOS os itens para não subcontar os totais.
      const PAGE_SIZE = 1000;
      const items: any[] = [];

      // Limita ao histórico recente (90 dias) para evitar timeout no dashboard.
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceIso = since.toISOString();

      for (let i = 0; i < 100; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('order_intent_items')
          .select(`
            id,
            qty,
            line_total_cents,
            added_from,
            created_at,
            order_intents (
              id,
              customer_id,
              customer_name,
              customer_whatsapp,
              status,
              created_at
            )
          `)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = data ?? [];
        items.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      
      // Filtrar pedidos não cancelados
      const validItems = items.filter(
        (item: any) => item.order_intents?.status !== 'CANCELADO'
      );
      
      // Calcular métricas gerais
      let catalogItems = 0;
      let catalogRevenue = 0;
      let productPageItems = 0;
      let productPageRevenue = 0;
      let unknownItems = 0;
      let unknownRevenue = 0;
      
      // Mapa para agrupar por cliente
      const customerMap = new Map<string, CustomerBehavior>();
      
      // Mapa para tendência diária (últimos 7 dias)
      const dailyMap = new Map<string, DailyTrend>();
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, {
          date: dateStr,
          catalogItems: 0,
          productPageItems: 0,
          catalogRevenue: 0,
          productPageRevenue: 0,
        });
      }
      
      // Processar itens
      for (const item of validItems as any[]) {
        const qty = item.qty || 0;
        const revenue = item.line_total_cents || 0;
        const source = item.added_from;
        const order = item.order_intents;
        const itemDate = item.created_at?.split('T')[0];
        
        // Contabilizar por origem
        if (source === 'catalog') {
          catalogItems += qty;
          catalogRevenue += revenue;
        } else if (source === 'product_page') {
          productPageItems += qty;
          productPageRevenue += revenue;
        } else {
          unknownItems += qty;
          unknownRevenue += revenue;
        }
        
        // Agrupar por cliente
        if (order?.customer_id || order?.customer_whatsapp) {
          const key = order.customer_id || order.customer_whatsapp;
          const existing = customerMap.get(key) || {
            customerId: order.customer_id,
            customerName: order.customer_name,
            customerWhatsapp: order.customer_whatsapp,
            totalOrders: 0,
            catalogItems: 0,
            productPageItems: 0,
            catalogRevenue: 0,
            productPageRevenue: 0,
            preferredSource: 'mixed' as const,
          };
          
          if (source === 'catalog') {
            existing.catalogItems += qty;
            existing.catalogRevenue += revenue;
          } else if (source === 'product_page') {
            existing.productPageItems += qty;
            existing.productPageRevenue += revenue;
          }
          
          customerMap.set(key, existing);
        }
        
        // Tendência diária
        if (itemDate && dailyMap.has(itemDate)) {
          const daily = dailyMap.get(itemDate)!;
          if (source === 'catalog') {
            daily.catalogItems += qty;
            daily.catalogRevenue += revenue;
          } else if (source === 'product_page') {
            daily.productPageItems += qty;
            daily.productPageRevenue += revenue;
          }
        }
      }
      
      // Contar pedidos únicos
      const uniqueOrders = new Set(validItems.map((i: any) => i.order_intents?.id)).size;
      
      // Calcular preferência de cada cliente
      const customers = Array.from(customerMap.values()).map(c => ({
        ...c,
        preferredSource: 
          c.catalogItems > c.productPageItems * 2 ? 'catalog' as const :
          c.productPageItems > c.catalogItems * 2 ? 'product_page' as const :
          'mixed' as const,
      }));
      
      // Top clientes por catálogo
      const topCatalogCustomers = customers
        .filter(c => c.catalogItems > 0)
        .sort((a, b) => b.catalogItems - a.catalogItems)
        .slice(0, 5);
      
      // Top clientes por página de produto
      const topProductPageCustomers = customers
        .filter(c => c.productPageItems > 0)
        .sort((a, b) => b.productPageItems - a.productPageItems)
        .slice(0, 5);
      
      const totalItems = catalogItems + productPageItems + unknownItems;
      
      return {
        totalOrders: uniqueOrders,
        totalItems,
        totalRevenue: catalogRevenue + productPageRevenue + unknownRevenue,
        catalogItems,
        catalogRevenue,
        productPageItems,
        productPageRevenue,
        unknownItems,
        unknownRevenue,
        catalogPercentage: totalItems > 0 ? Math.round((catalogItems / totalItems) * 100) : 0,
        productPagePercentage: totalItems > 0 ? Math.round((productPageItems / totalItems) * 100) : 0,
        topCatalogCustomers,
        topProductPageCustomers,
        dailyTrend: Array.from(dailyMap.values()),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
