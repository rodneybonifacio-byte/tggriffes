import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreSettings {
  id: string;
  store_name: string;
  store_logo_url: string | null;
  seller_whatsapp: string;
  origin_cep: string;
  primary_color: string | null;
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as StoreSettings | null;
    },
  });
}
