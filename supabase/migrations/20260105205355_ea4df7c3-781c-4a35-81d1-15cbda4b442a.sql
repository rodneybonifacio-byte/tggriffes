-- Create storage bucket for order PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-pdfs', 'order-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to order PDFs
CREATE POLICY "Order PDFs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-pdfs');

-- Allow service role to upload order PDFs
CREATE POLICY "Service role can upload order PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'order-pdfs');