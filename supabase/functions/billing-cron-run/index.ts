import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function monthStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: settings } = await supabase.from('billing_settings').select('*').limit(1).single();
    if (!settings) throw new Error('billing_settings ausente');

    const today = new Date();
    const day = today.getUTCDate();
    const refMonth = monthStart(today);
    const actions: any[] = [];

    // 1. Se hoje é dia de cobrança, garante fatura do mês com PIX
    if (day === settings.charge_day) {
      const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/c6-pix-charge`;
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference_month: refMonth }),
      });
      actions.push({ step: 'charge', status: r.status });
    }

    // 2. Verifica pagamentos pendentes
    const checkUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/c6-pix-check`;
    const c = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    actions.push({ step: 'check', status: c.status });

    // 3. Aplica regras de atraso/bloqueio
    const todayStr = today.toISOString().slice(0, 10);
    // Marca como ATRASADO faturas vencidas e não pagas
    await supabase.from('billing_invoices')
      .update({ status: 'ATRASADO' })
      .eq('status', 'PENDENTE')
      .lt('due_date', todayStr);

    // A carência já está embutida em due_date (charge_day + grace_days).
    // Portanto, basta bloquear qualquer fatura vencida (due_date < hoje) ainda não paga.
    const { data: toBlock } = await supabase.from('billing_invoices')
      .select('id').in('status', ['ATRASADO', 'PENDENTE'])
      .lt('due_date', todayStr);

    if (toBlock && toBlock.length > 0) {
      const ids = toBlock.map(i => i.id);
      await supabase.from('billing_invoices').update({ status: 'BLOQUEADO' }).in('id', ids);
      await supabase.from('billing_settings').update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_invoice_id: ids[0],
      }).eq('id', settings.id);
      actions.push({ step: 'block', invoices: ids });
    }

    return new Response(JSON.stringify({ ok: true, actions }), {
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