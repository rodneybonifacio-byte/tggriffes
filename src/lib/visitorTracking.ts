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

export function detectTrafficSource(referrer: string): string {
  // Persist first-touch source for the session
  try {
    const cached = sessionStorage.getItem('tg_traffic_source');
    if (cached) return cached;
  } catch {}

  const ref = (referrer || '').toLowerCase();
  let source = 'direct';
  if (!ref) source = 'direct';
  else if (ref.includes('whatsapp') || ref.includes('wa.me') || ref.includes('api.whatsapp')) source = 'whatsapp';
  else if (ref.includes('instagram')) source = 'instagram';
  else if (ref.includes('facebook') || ref.includes('fb.com') || ref.includes('fbclid')) source = 'facebook';
  else if (ref.includes('google')) source = 'google';
  else if (ref.includes('bing')) source = 'bing';
  else if (ref.includes('t.co') || ref.includes('twitter') || ref.includes('x.com')) source = 'twitter';
  else if (ref.includes('tiktok')) source = 'tiktok';
  else source = 'other';

  // utm_source override
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    if (utm) source = utm.toLowerCase();
  } catch {}

  try {
    sessionStorage.setItem('tg_traffic_source', source);
  } catch {}
  return source;
}

export async function trackPageView(path: string) {
  // Don't track admin routes
  if (path.startsWith('/admin') || path.startsWith('/minha-conta') || path.startsWith('/pedidos/pdf')) {
    return;
  }

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const trafficSource = detectTrafficSource(referrer);

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
      traffic_source: trafficSource,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (err) {
    // Silenciar erros de tracking para não impactar UX
    console.debug('[tracking] erro:', err);
  }
}