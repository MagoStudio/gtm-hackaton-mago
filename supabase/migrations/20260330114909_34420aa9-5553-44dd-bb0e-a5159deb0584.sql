
-- Create quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  last_edited_by uuid,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  quote_number text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  parent_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  company_name text,
  contact_person text,
  contact_email text,
  status text NOT NULL DEFAULT 'draft',
  hosting_model text,
  line_items jsonb NOT NULL DEFAULT '{}',
  total_arr numeric NOT NULL DEFAULT 0,
  total_onetime numeric NOT NULL DEFAULT 0,
  total_year1 numeric NOT NULL DEFAULT 0,
  contract_discount numeric NOT NULL DEFAULT 0,
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create quote_settings table (single shared row)
CREATE TABLE public.quote_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_settings ENABLE ROW LEVEL SECURITY;

-- Quotes: all authenticated can CRUD
CREATE POLICY "Authenticated users full access on quotes"
ON public.quotes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Quote settings: all authenticated can read and update
CREATE POLICY "Authenticated users can read quote settings"
ON public.quote_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update quote settings"
ON public.quote_settings FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert quote settings"
ON public.quote_settings FOR INSERT TO authenticated
WITH CHECK (true);
