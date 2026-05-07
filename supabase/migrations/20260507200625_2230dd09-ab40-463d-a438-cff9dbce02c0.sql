
-- Tabela de faturas mensais
CREATE TABLE public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month DATE NOT NULL UNIQUE, -- primeiro dia do mês de referência
  amount_cents INTEGER NOT NULL DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, PAGO, ATRASADO, BLOQUEADO, CANCELADO
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  
  -- Dados PIX C6
  c6_txid TEXT,
  c6_correlation_id TEXT,
  pix_qrcode TEXT,        -- imagem base64
  pix_copia_cola TEXT,    -- código copia-cola
  pix_expires_at TIMESTAMPTZ,
  
  -- Controle
  attempts INTEGER NOT NULL DEFAULT 0,
  last_check_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações de cobrança (linha única)
CREATE TABLE public.billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_amount_cents INTEGER NOT NULL DEFAULT 10000,
  charge_day INTEGER NOT NULL DEFAULT 6,
  grace_days INTEGER NOT NULL DEFAULT 3,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_at TIMESTAMPTZ,
  blocked_invoice_id UUID,
  pix_recipient_name TEXT NOT NULL DEFAULT 'BRHUB Tecnologia',
  pix_recipient_document TEXT NOT NULL DEFAULT '56691028000177',
  notification_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.billing_settings (monthly_amount_cents, charge_day, grace_days)
VALUES (10000, 6, 3);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Policies invoices: admin gerencia tudo
CREATE POLICY "Admins manage invoices" ON public.billing_invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Permite a edge function (service role) operar - service role bypassa RLS
-- Permite que qualquer um veja se há fatura bloqueada (para tela de bloqueio do site)
CREATE POLICY "Anyone can view blocking status" ON public.billing_invoices
  FOR SELECT TO anon, authenticated
  USING (status = 'BLOQUEADO');

-- Policies settings: admin edita; todos podem ler (necessário para checar bloqueio do site público)
CREATE POLICY "Anyone can view billing settings" ON public.billing_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins update billing settings" ON public.billing_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER set_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_billing_settings_updated_at
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX idx_billing_invoices_due ON public.billing_invoices(due_date);
