import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SiteUnavailable from '@/pages/SiteUnavailable';

/**
 * Bloqueia o site público quando billing_settings.is_blocked = true.
 * Rotas /admin continuam acessíveis para o lojista quitar a fatura.
 */
export function SiteBlockGuard({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.from('billing_settings' as any).select('is_blocked').limit(1).maybeSingle()
      .then(({ data }) => { if (mounted) setBlocked(!!(data as any)?.is_blocked); });
    return () => { mounted = false; };
  }, []);

  if (blocked === null) return null;
  const path = window.location.pathname;
  const isAdmin = path.startsWith('/admin');
  if (blocked && !isAdmin) return <SiteUnavailable />;
  return <>{children}</>;
}