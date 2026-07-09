ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_name TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS description TEXT;