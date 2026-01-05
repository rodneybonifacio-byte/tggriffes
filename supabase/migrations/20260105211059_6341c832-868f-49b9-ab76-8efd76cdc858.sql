-- Add order_number column with auto-increment sequence
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;

ALTER TABLE public.order_intents 
ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE DEFAULT nextval('order_number_seq');