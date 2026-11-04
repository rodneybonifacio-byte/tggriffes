CREATE POLICY "Admins and sellers can view invoices"
ON public.billing_invoices
FOR SELECT
TO authenticated
USING (public.is_admin_or_seller(auth.uid()));