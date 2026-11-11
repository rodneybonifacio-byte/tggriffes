DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Staff can update product images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin_or_seller(auth.uid()))
WITH CHECK (bucket_id = 'product-images' AND public.is_admin_or_seller(auth.uid()));
CREATE POLICY "Staff can delete product images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin_or_seller(auth.uid()));