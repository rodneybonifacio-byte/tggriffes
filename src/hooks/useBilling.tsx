import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBillingSettings() {
  return useQuery({
    queryKey: ['billing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_settings' as any).select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ['billing-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_invoices' as any).select('*').order('reference_month', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useGenerateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (referenceMonth?: string) => {
      const { data, error } = await supabase.functions.invoke('c6-pix-charge', {
        body: { reference_month: referenceMonth },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-settings'] });
    },
  });
}

export function useCheckPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId?: string) => {
      const { data, error } = await supabase.functions.invoke('c6-pix-check', {
        body: invoiceId ? { invoice_id: invoiceId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-settings'] });
    },
  });
}