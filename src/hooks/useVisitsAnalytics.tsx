import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VisitsAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  newVisitors: number;
  dailyTrend: { date: string; views: number; uniqueVisitors: number }[];
  trafficSources: { source: string; views: number; percentage: number }[];
  trafficMediums: { medium: string; views: number; percentage: number }[];
  topReferrerDomains: { domain: string; views: number }[];
  topCampaigns: { campaign: string; views: number }[];
  deviceBreakdown: { device: string; views: number; percentage: number }[];
  topProducts: { slug: string; name: string; image: string | null; views: number }[];
}

export function useVisitsAnalytics(days: 7 | 30 = 30) {
  return useQuery({
    queryKey: ['visits-analytics', 'rpc-v1', days],
    queryFn: async (): Promise<VisitsAnalytics> => {
      // Toda a agregação roda no Postgres via RPC – uma única requisição
      // devolve o payload já pronto para o dashboard, evitando puxar
      // centenas de milhares de linhas para o cliente.
      const { data, error } = await supabase.rpc('dashboard_visits_summary', {
        p_days: days,
      });
      if (error) throw error;
      return (data ?? {
        totalViews: 0,
        uniqueVisitors: 0,
        returningVisitors: 0,
        newVisitors: 0,
        dailyTrend: [],
        trafficSources: [],
        trafficMediums: [],
        topReferrerDomains: [],
        topCampaigns: [],
        deviceBreakdown: [],
        topProducts: [],
      }) as VisitsAnalytics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}