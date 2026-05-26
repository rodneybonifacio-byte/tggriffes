import { supabase } from '@/integrations/supabase/client';

const VISITOR_KEY = 'tg_visitor_id';
const SESSION_KEY = 'tg_session_id';

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export interface TrafficInfo {
  source: string;          // canonical source (whatsapp, instagram, google, etc.)
  medium: string;          // social | search | paid | email | referral | direct
  campaign: string | null; // utm_campaign
  content: string | null;
  term: string | null;
  utmSource: string | null;
  referrerDomain: string | null;
}

function classifyByDomain(domain: string): { source: string; medium: string } {
  const d = domain.toLowerCase();
  if (!d) return { source: 'direct', medium: 'direct' };
  // Social
  if (d.includes('whatsapp') || d === 'wa.me' || d.includes('api.whatsapp')) return { source: 'whatsapp', medium: 'social' };
  if (d.includes('instagram') || d === 'l.instagram.com') return { source: 'instagram', medium: 'social' };
  if (d.includes('facebook') || d === 'fb.com' || d === 'l.facebook.com' || d === 'm.facebook.com') return { source: 'facebook', medium: 'social' };
  if (d.includes('tiktok')) return { source: 'tiktok', medium: 'social' };
  if (d.includes('twitter') || d === 't.co' || d.includes('x.com')) return { source: 'twitter', medium: 'social' };
  if (d.includes('linkedin') || d === 'lnkd.in') return { source: 'linkedin', medium: 'social' };
  if (d.includes('pinterest')) return { source: 'pinterest', medium: 'social' };
  if (d.includes('youtube') || d === 'youtu.be') return { source: 'youtube', medium: 'social' };
  if (d.includes('telegram') || d === 't.me') return { source: 'telegram', medium: 'social' };
  if (d.includes('threads.net')) return { source: 'threads', medium: 'social' };
  if (d.includes('reddit')) return { source: 'reddit', medium: 'social' };
  if (d.includes('kwai')) return { source: 'kwai', medium: 'social' };
  // Search engines
  if (d.includes('google.')) return { source: 'google', medium: 'search' };
  if (d.includes('bing.com')) return { source: 'bing', medium: 'search' };
  if (d.includes('duckduckgo')) return { source: 'duckduckgo', medium: 'search' };
  if (d.includes('yahoo.')) return { source: 'yahoo', medium: 'search' };
  if (d.includes('yandex')) return { source: 'yandex', medium: 'search' };
  if (d.includes('ecosia')) return { source: 'ecosia', medium: 'search' };
  // Email webmails
  if (d.includes('mail.google') || d.includes('outlook') || d === 'mail.yahoo.com') return { source: d, medium: 'email' };
  return { source: d, medium: 'referral' };
}

function getReferrerDomain(referrer: string): string {
  try {
    if (!referrer) return '';
    const u = new URL(referrer);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function detectTrafficInfo(referrer: string): TrafficInfo {
  // First-touch persistence for the session
  try {
    const cached = sessionStorage.getItem('tg_traffic_info');
    if (cached) return JSON.parse(cached) as TrafficInfo;
  } catch {}

  const domain = getReferrerDomain(referrer);
  let { source, medium } = classifyByDomain(domain);

  // Same-site referrer counts as direct (internal nav)
  try {
    if (domain && typeof window !== 'undefined' && domain === window.location.hostname.replace(/^www\./, '')) {
      source = 'direct';
      medium = 'direct';
    }
  } catch {}

  let campaign: string | null = null;
  let content: string | null = null;
  let term: string | null = null;
  let utmSource: string | null = null;

  try {
    const params = new URLSearchParams(window.location.search);
    utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    campaign = params.get('utm_campaign');
    content = params.get('utm_content');
    term = params.get('utm_term');
    const fbclid = params.get('fbclid');
    const gclid = params.get('gclid');

    if (utmSource) source = utmSource.toLowerCase();
    if (utmMedium) medium = utmMedium.toLowerCase();
    else if (gclid) medium = 'paid';
    else if (fbclid && medium === 'direct') { source = 'facebook'; medium = 'social'; }
  } catch {}

  const info: TrafficInfo = {
    source,
    medium,
    campaign,
    content,
    term,
    utmSource,
    referrerDomain: domain || null,
  };

  try {
    sessionStorage.setItem('tg_traffic_info', JSON.stringify(info));
  } catch {}
  return info;
}

// Backwards-compat helper
export function detectTrafficSource(referrer: string): string {
  return detectTrafficInfo(referrer).source;
}

function getDeviceType(): string {
  try {
    const ua = navigator.userAgent;
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

export async function trackPageView(path: string) {
  // Don't track admin routes
  if (path.startsWith('/admin') || path.startsWith('/minha-conta') || path.startsWith('/pedidos/pdf')) {
    return;
  }

  // Don't track development / preview environments (Lovable sandbox, localhost, etc.)
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovable.dev') ||
      host.endsWith('.lovableproject.com')
    ) {
      return;
    }
  } catch {}

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const info = detectTrafficInfo(referrer);

  let pageType: 'home' | 'product' | 'other' = 'other';
  if (path === '/' || path === '') pageType = 'home';
  else if (path.startsWith('/produto/')) pageType = 'product';

  try {
    await supabase.from('page_views').insert({
      visitor_id: visitorId,
      session_id: sessionId,
      path,
      page_type: pageType,
      referrer: referrer || null,
      traffic_source: info.source,
      traffic_medium: info.medium,
      referrer_domain: info.referrerDomain,
      utm_source: info.utmSource,
      utm_campaign: info.campaign,
      utm_content: info.content,
      utm_term: info.term,
      device_type: getDeviceType(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    } as any);
  } catch (err) {
    // Silenciar erros de tracking para não impactar UX
    console.debug('[tracking] erro:', err);
  }
}