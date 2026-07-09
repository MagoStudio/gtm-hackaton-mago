CREATE TABLE public.deal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  author text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deal notes"
ON public.deal_notes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert deal notes"
ON public.deal_notes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deals
    JOIN uploads ON uploads.id = deals.upload_id
    WHERE deals.id = deal_notes.deal_id
      AND uploads.user_id = auth.uid()
  )
);

CREATE INDEX idx_deal_notes_deal_id ON public.deal_notes(deal_id);