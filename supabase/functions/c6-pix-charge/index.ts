import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createPixCob } from '../_shared/c6.ts';
import { annualPriceCents, annualCoverageEnd } from '../_shared/billingRules.ts';

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
    const regenerate: boolean = body.regenerate === true;

    const { data: settings, error: settingsErr } = await supabase
      .from('billing_settings').select('*').limit(1).single();
    if (settingsErr) throw settingsErr;

    // A confirmed annual payment replaces monthly charges throughout its coverage.
    const { data: coverage, error: coverageError } = await supabase.from('billing_invoices')
      .select('*').eq('plan', 'annual').eq('status', 'PAGO').not('paid_at', 'is', null)
      .lte('reference_month', referenceMonth).gt('coverage_end', referenceMonth)
      .limit(1).maybeSingle();
    if (coverageError) throw coverageError;
    if (!invoiceId && coverage) {
      return new Response(JSON.stringify({ ok: true, covered: true, invoice: coverage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let existing: any = null;
    if (invoiceId) {
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .eq('id', invoiceId).maybeSingle();
      existing = data;
    } else if (plan === 'annual') {
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .eq('reference_month', referenceMonth)
        .eq('plan', 'annual')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from('billing_invoices').select('*')
        .eq('reference_month', referenceMonth)
        .eq('plan', 'monthly')
        .maybeSingle();
      existing = data;
    }

    let invoice = existing;

    // "Gerar novo PIX": limpa o código atual para forçar uma cobrança nova.
    // Feito aqui (com chave de serviço) para que quem paga não precise de
    // permissão de escrita nas faturas.
    if (invoice && regenerate && invoice.status !== 'PAGO' && invoice.status !== 'CANCELADO') {
      const { error: clearErr } = await supabase
        .from('billing_invoices').update({
          c6_txid: null,
          c6_correlation_id: null,
          pix_qrcode: null,
          pix_copia_cola: null,
          pix_expires_at: null,
        }).eq('id', invoice.id);
      if (clearErr) throw clearErr;
      invoice = {
        ...invoice,
        c6_txid: null,
        c6_correlation_id: null,
        pix_qrcode: null,
        pix_copia_cola: null,
        pix_expires_at: null,
      };
    }

    if (!invoice) {
      const monthlyCents = settings.monthly_amount_cents;
      const annualCents = annualPriceCents(monthlyCents);
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
          plan,
          coverage_end: plan === 'annual' ? annualCoverageEnd(referenceMonth) : null,
        }).select().single();
      if (insErr) throw insErr;
      invoice = created;
    }

    if (invoice.status === 'PAGO' || invoice.status === 'CANCELADO' ||
        (invoice.pix_copia_cola && invoice.pix_expires_at > new Date().toISOString())) {
      return new Response(JSON.stringify({ ok: true, invoice }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gera nova cobrança PIX (expira em 7 dias)
    const cob = await createPixCob({
      amountCents: invoice.amount_cents,
      expiresInSeconds: 7 * 24 * 3600,
      payerName: 'TG Griffes',
      description: invoice.plan === 'annual'
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