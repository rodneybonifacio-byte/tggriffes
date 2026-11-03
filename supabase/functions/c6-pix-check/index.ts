import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getPixCobStatus } from '../_shared/c6.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const invoiceId: string | undefined = body.invoice_id;

    let query = supabase.from('billing_invoices').select('*')
      .in('status', ['PENDENTE', 'ATRASADO', 'BLOQUEADO'])
      .not('c6_txid', 'is', null);
    if (invoiceId) query = query.eq('id', invoiceId);

    const { data: invoices, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const inv of invoices ?? []) {
      try {
        const st = await getPixCobStatus(inv.c6_txid);
        const updates: Record<string, unknown> = { last_check_at: new Date().toISOString() };
        // Só damos baixa quando o C6 confirma o recebimento (CONCLUIDA + pix recebido)
        // e o valor pago cobre o valor da fatura. Caso contrário, registramos o motivo
        // em last_error para auditoria — sem alterar o status.
        if (st.paid) {
          const expected = inv.amount_cents as number;
          const received = st.paidAmountCents ?? 0;
          if (received >= expected) {
            updates.status = 'PAGO';
            updates.paid_at = st.paidAt ?? new Date().toISOString();
            updates.last_error = null;
          } else {
            updates.last_error = `Pagamento parcial detectado: recebido R$ ${(received/100).toFixed(2)} de R$ ${(expected/100).toFixed(2)}`;
          }
        }
        const { error: updateError } = await supabase.from('billing_invoices').update(updates).eq('id', inv.id);
        if (updateError) throw updateError;

        // Se foi pago e era a fatura bloqueadora, libera o site
        if (updates.status === 'PAGO') {
          if (inv.plan === 'annual' && inv.coverage_end) {
            // Replace only unpaid monthly invoices within the confirmed annual period.
            const { error: cancelError } = await supabase.from('billing_invoices')
              .update({ status: 'CANCELADO' }).eq('plan', 'monthly')
              .in('status', ['PENDENTE', 'ATRASADO', 'BLOQUEADO'])
              .is('paid_at', null).gte('reference_month', inv.reference_month)
              .lt('reference_month', inv.coverage_end);
            if (cancelError) throw cancelError;
          }
          const { data: settings } = await supabase.from('billing_settings').select('*').limit(1).single();
          const { data: blockingInvoice } = settings?.blocked_invoice_id
            ? await supabase.from('billing_invoices').select('status').eq('id', settings.blocked_invoice_id).maybeSingle()
            : { data: null };
          if (settings?.is_blocked && (settings.blocked_invoice_id === inv.id || blockingInvoice?.status === 'CANCELADO')) {
            const { data: otherUnpaid, error: unpaidError } = await supabase.from('billing_invoices')
              .select('id').eq('plan', 'monthly').in('status', ['PENDENTE', 'ATRASADO', 'BLOQUEADO'])
              .lt('due_date', new Date().toISOString().slice(0, 10)).limit(1);
            if (unpaidError) throw unpaidError;
            if (!otherUnpaid?.length) {
            await supabase.from('billing_settings').update({
              is_blocked: false,
              blocked_at: null,
              blocked_invoice_id: null,
            }).eq('id', settings.id);
            }
          }
        }
        results.push({
          id: inv.id,
          paid: updates.status === 'PAGO',
          status: st.status,
          received_cents: st.paidAmountCents ?? 0,
          expected_cents: inv.amount_cents,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from('billing_invoices').update({
          last_check_at: new Date().toISOString(), last_error: msg,
        }).eq('id', inv.id);
        results.push({ id: inv.id, error: msg });
      }
    }

    // Retry coverage reconciliation even if a previous check saved PAGO before failing.
    const { data: annualPayments, error: annualError } = await supabase.from('billing_invoices')
      .select('reference_month,coverage_end').eq('plan', 'annual').eq('status', 'PAGO')
      .not('paid_at', 'is', null);
    if (annualError) throw annualError;
    for (const annual of annualPayments ?? []) {
      const { error } = await supabase.from('billing_invoices').update({ status: 'CANCELADO' })
        .eq('plan', 'monthly').in('status', ['PENDENTE', 'ATRASADO', 'BLOQUEADO'])
        .is('paid_at', null).gte('reference_month', annual.reference_month)
        .lt('reference_month', annual.coverage_end);
      if (error) throw error;
    }
    const { data: currentSettings } = await supabase.from('billing_settings').select('*').limit(1).single();
    if (currentSettings?.is_blocked && currentSettings.blocked_invoice_id) {
      const { data: blocker } = await supabase.from('billing_invoices').select('status').eq('id', currentSettings.blocked_invoice_id).single();
      if (blocker && ['PAGO', 'CANCELADO'].includes(blocker.status)) {
        const { data: overdue, error } = await supabase.from('billing_invoices').select('id')
          .eq('plan', 'monthly').in('status', ['PENDENTE', 'ATRASADO', 'BLOQUEADO'])
          .lt('due_date', new Date().toISOString().slice(0, 10)).limit(1);
        if (error) throw error;
        if (!overdue?.length) {
          const { error: unlockError } = await supabase.from('billing_settings').update({ is_blocked: false, blocked_at: null, blocked_invoice_id: null }).eq('id', currentSettings.id);
          if (unlockError) throw unlockError;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});