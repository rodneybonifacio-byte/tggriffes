ALTER TABLE public.billing_invoices ADD COLUMN plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly','annual')), ADD COLUMN coverage_end date;
UPDATE public.billing_invoices SET plan = 'annual', coverage_end = (reference_month + interval '1 year')::date WHERE custom_label ILIKE 'Anual%';
ALTER TABLE public.billing_invoices DROP CONSTRAINT billing_invoices_reference_month_key;
CREATE UNIQUE INDEX billing_invoices_monthly_reference_key ON public.billing_invoices(reference_month) WHERE plan = 'monthly';
CREATE UNIQUE INDEX billing_invoices_annual_reference_key ON public.billing_invoices(reference_month) WHERE plan = 'annual';
ALTER TABLE public.billing_invoices ADD CONSTRAINT billing_annual_coverage_valid CHECK ((plan = 'monthly' AND coverage_end IS NULL) OR (plan = 'annual' AND coverage_end = (reference_month + interval '1 year')::date));