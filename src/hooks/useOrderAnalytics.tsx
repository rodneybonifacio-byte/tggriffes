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
    queryKey: ['order-analytics', 'rpc-v1'],
    queryFn: async (): Promise<OrderSourceAnalytics> => {
      // Agregação feita no Postgres via RPC. Devolve o payload pronto.
      const { data, error } = await supabase.rpc('dashboard_order_analytics', {
        p_days: 90,
      });
      if (error) throw error;
      return ((data as unknown) ?? {
        totalOrders: 0,
        totalItems: 0,
        totalRevenue: 0,
        catalogItems: 0,
        catalogRevenue: 0,
        productPageItems: 0,
        productPageRevenue: 0,
        unknownItems: 0,
        unknownRevenue: 0,
        catalogPercentage: 0,
        productPagePercentage: 0,
        topCatalogCustomers: [],
        topProductPageCustomers: [],
        dailyTrend: [],
      }) as OrderSourceAnalytics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
