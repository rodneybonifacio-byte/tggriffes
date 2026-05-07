ALTER TABLE public.billing_invoices ADD COLUMN IF NOT EXISTS custom_label text;
UPDATE public.billing_invoices SET custom_label = 'Abril e Maio 2026' WHERE id = '31054de4-191c-4457-8749-2244d7f3e650';