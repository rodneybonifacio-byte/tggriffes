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

const PAGE_SIZE = 1000;

export function useVisitsAnalytics(days: 7 | 30 = 30) {
  return useQuery({
    queryKey: ['visits-analytics', days],
    queryFn: async (): Promise<VisitsAnalytics> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();

      // Paginate all page_views from window
      const rows: any[] = [];
      for (let i = 0; i < 50; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from('page_views')
          .select('visitor_id, path, page_type, traffic_source, traffic_medium, referrer_domain, utm_campaign, device_type, created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = data ?? [];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      // Daily trend
      const dailyMap = new Map<string, { views: number; visitors: Set<string> }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyMap.set(key, { views: 0, visitors: new Set() });
      }

      const visitorFirstSeen = new Map<string, string>();
      const sourceMap = new Map<string, number>();
      const mediumMap = new Map<string, number>();
      const domainMap = new Map<string, number>();
      const campaignMap = new Map<string, number>();
      const deviceMap = new Map<string, number>();
      const productPathCount = new Map<string, number>();
      const allVisitors = new Set<string>();

      for (const r of rows) {
        // Ignore visits from Lovable preview/dev environments (legacy data)
        const dom = (r.referrer_domain || '').toLowerCase();
        if (
          dom.endsWith('.lovable.app') ||
          dom.endsWith('.lovable.dev') ||
          dom.endsWith('.lovableproject.com') ||
          dom === 'localhost' ||
          dom === '127.0.0.1'
        ) {
          continue;
        }

        const dateKey = (r.created_at as string).split('T')[0];
        const daily = dailyMap.get(dateKey);
        if (daily) {
          daily.views += 1;
          daily.visitors.add(r.visitor_id);
        }

        allVisitors.add(r.visitor_id);
        // track first seen (rows are DESC, so overwrite to get earliest)
        visitorFirstSeen.set(r.visitor_id, r.created_at);

        const src = r.traffic_source || 'direct';
        sourceMap.set(src, (sourceMap.get(src) || 0) + 1);

        const med = r.traffic_medium || 'direct';
        mediumMap.set(med, (mediumMap.get(med) || 0) + 1);

        if (r.referrer_domain) {
          domainMap.set(r.referrer_domain, (domainMap.get(r.referrer_domain) || 0) + 1);
        }
        if (r.utm_campaign) {
          campaignMap.set(r.utm_campaign, (campaignMap.get(r.utm_campaign) || 0) + 1);
        }
        const dev = r.device_type || 'unknown';
        deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);

        if (r.page_type === 'product' && typeof r.path === 'string') {
          productPathCount.set(r.path, (productPathCount.get(r.path) || 0) + 1);
        }
      }

      // New vs returning: a visitor is "returning" if their visitor_id has visits
      // both within and BEFORE the window. Query distinct visitors prior to window.
      const newVisitorIds = new Set<string>(allVisitors);
      if (allVisitors.size > 0) {
        // chunk in 200 to avoid URL limits
        const ids = Array.from(allVisitors);
        const chunkSize = 200;
        const returningIds = new Set<string>();
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data: prior } = await supabase
            .from('page_views')
            .select('visitor_id')
            .lt('created_at', sinceIso)
            .in('visitor_id', chunk)
            .limit(1000);
          for (const p of prior ?? []) {
            returningIds.add(p.visitor_id as string);
            newVisitorIds.delete(p.visitor_id as string);
          }
        }
        // newVisitorIds now holds only those never seen before window
        var returningVisitors = returningIds.size;
      } else {
        var returningVisitors = 0;
      }

      // Top products: resolve slug from path
      const topSlugs = Array.from(productPathCount.entries())
        .map(([path, views]) => ({ slug: path.replace('/produto/', ''), views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      let topProducts: VisitsAnalytics['topProducts'] = [];
      if (topSlugs.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('slug, name, main_image_url')
          .in('slug', topSlugs.map(t => t.slug));
        const byslug = new Map((products ?? []).map(p => [p.slug, p]));
        topProducts = topSlugs.map(t => {
          const p = byslug.get(t.slug);
          return {
            slug: t.slug,
            name: p?.name || t.slug,
            image: p?.main_image_url || null,
            views: t.views,
          };
        });
      }

      const totalSourceViews = Array.from(sourceMap.values()).reduce((a, b) => a + b, 0) || 1;
      const trafficSources = Array.from(sourceMap.entries())
        .map(([source, views]) => ({
          source,
          views,
          percentage: Math.round((views / totalSourceViews) * 100),
        }))
        .sort((a, b) => b.views - a.views);

      const totalMediumViews = Array.from(mediumMap.values()).reduce((a, b) => a + b, 0) || 1;
      const trafficMediums = Array.from(mediumMap.entries())
        .map(([medium, views]) => ({
          medium,
          views,
          percentage: Math.round((views / totalMediumViews) * 100),
        }))
        .sort((a, b) => b.views - a.views);

      const topReferrerDomains = Array.from(domainMap.entries())
        .map(([domain, views]) => ({ domain, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);

      const topCampaigns = Array.from(campaignMap.entries())
        .map(([campaign, views]) => ({ campaign, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 6);

      const totalDeviceViews = Array.from(deviceMap.values()).reduce((a, b) => a + b, 0) || 1;
      const deviceBreakdown = Array.from(deviceMap.entries())
        .map(([device, views]) => ({
          device,
          views,
          percentage: Math.round((views / totalDeviceViews) * 100),
        }))
        .sort((a, b) => b.views - a.views);

      const dailyTrend = Array.from(dailyMap.entries()).map(([date, v]) => ({
        date,
        views: v.views,
        uniqueVisitors: v.visitors.size,
      }));

      return {
        totalViews: rows.length,
        uniqueVisitors: allVisitors.size,
        returningVisitors,
        newVisitors: newVisitorIds.size,
        dailyTrend,
        trafficSources,
        trafficMediums,
        topReferrerDomains,
        topCampaigns,
        deviceBreakdown,
        topProducts,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}