ALTER TABLE public.deal_notes ADD COLUMN note_type text NOT NULL DEFAULT 'note';
ALTER TABLE public.deal_notes ADD COLUMN granola_meeting_id text;