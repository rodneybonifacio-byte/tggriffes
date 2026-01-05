-- Tighten storage security: do NOT allow public uploads to order-pdfs
DROP POLICY IF EXISTS "Service role can upload order PDFs" ON storage.objects;