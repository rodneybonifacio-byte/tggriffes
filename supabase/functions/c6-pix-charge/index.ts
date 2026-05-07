import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createPixCob } from '../_shared/c6.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function monthStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function dueDate(monthRef: string, chargeDay: number, graceDays: number): string {
  const [y, m] = monthRef.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, chargeDay + graceDays));
  return dt.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const referenceMonth: string = body.reference_month ?? monthStart();
    const plan: 'monthly' | 'annual' = body.plan === 'annual' ? 'annual' : 'monthly';
    const invoiceId: string | undefined = body.invoice_id;

    const { data: settings, error: settingsErr } = await supabase
      .from('billing_settings').select('*').limit(1).single();
    if (settingsErr) throw settingsErr;

    let existing: any = null;
    if (invoiceId) {
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .eq('id', invoiceId).maybeSingle();
      existing = data;
    } else if (plan === 'annual') {
      const year = referenceMonth.slice(0, 4);
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .gte('reference_month', `${year}-01-01`)
        .lte('reference_month', `${year}-12-31`)
        .ilike('custom_label', 'Anual%')
        .neq('status', 'PAGO')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .eq('reference_month', referenceMonth)
        .maybeSingle();
      existing = data;
    }

    let invoice = existing;
    if (!invoice) {
      const monthlyCents = settings.monthly_amount_cents;
      const annualCents = Math.round(monthlyCents * 12 * 0.8); // 20% off
      const amountCents = plan === 'annual' ? annualCents : monthlyCents;
      const customLabel = plan === 'annual'
        ? `Anual ${referenceMonth.slice(0, 4)} (12 meses, 20% OFF)`
        : null;
      const { data: created, error: insErr } = await supabase
        .from('billing_invoices').insert({
          reference_month: referenceMonth,
          amount_cents: amountCents,
          due_date: dueDate(referenceMonth, settings.charge_day, settings.grace_days),
          status: 'PENDENTE',
          custom_label: customLabel,
        }).select().single();
      if (insErr) throw insErr;
      invoice = created;
    }

    if (invoice.status === 'PAGO') {
      return new Response(JSON.stringify({ ok: true, invoice }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gera nova cobrança PIX (expira em 7 dias)
    const cob = await createPixCob({
      amountCents: invoice.amount_cents,
      expiresInSeconds: 7 * 24 * 3600,
      payerName: 'TG Griffes',
      description: plan === 'annual'
        ? `Plano Anual BRHUB ${referenceMonth.slice(0, 4)} - 20% OFF`
        : `Mensalidade BRHUB ${referenceMonth.slice(0, 7)}`,
    });

    const { data: updated, error: updErr } = await supabase
      .from('billing_invoices').update({
        c6_txid: cob.txid,
        c6_correlation_id: cob.correlationId,
        pix_qrcode: cob.qrCodeBase64,
        pix_copia_cola: cob.pixCopiaCola,
        pix_expires_at: cob.expiresAt,
        attempts: (invoice.attempts ?? 0) + 1,
        last_error: null,
      }).eq('id', invoice.id).select().single();
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, invoice: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('c6-pix-charge error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});