
-- Table for multiple contacts per deal
CREATE TABLE public.deal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  is_champion boolean NOT NULL DEFAULT false,
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  linkedin_url text,
  company text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can manage contacts on deals they own
CREATE POLICY "Users can view deal contacts"
  ON public.deal_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert deal contacts"
  ON public.deal_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals JOIN uploads ON uploads.id = deals.upload_id
      WHERE deals.id = deal_contacts.deal_id AND uploads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update deal contacts"
  ON public.deal_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals JOIN uploads ON uploads.id = deals.upload_id
      WHERE deals.id = deal_contacts.deal_id AND uploads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete deal contacts"
  ON public.deal_contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals JOIN uploads ON uploads.id = deals.upload_id
      WHERE deals.id = deal_contacts.deal_id AND uploads.user_id = auth.uid()
    )
  );
