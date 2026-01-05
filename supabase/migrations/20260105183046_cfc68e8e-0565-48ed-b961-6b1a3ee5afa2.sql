-- Remover a constraint antiga de product_id + size
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_size_key;

-- Adicionar nova constraint que inclui a cor
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_product_id_size_color_key UNIQUE (product_id, size, color);