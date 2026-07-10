-- Outreach sequences (email now; `channel` on each step leaves room for
-- linkedin_invite / linkedin_message later) and per-lead enrollments that a
-- scheduler advances step by step.

CREATE TABLE public.sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled sequence',
  tier text,
  -- steps: [{ channel: 'email', delay_hours: number, subject: string, body: string }]
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sequences" ON public.sequences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  -- active | completed | stopped | error
  status text NOT NULL DEFAULT 'active',
  next_action_at timestamptz NOT NULL DEFAULT now(),
  last_step_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own enrollments" ON public.sequence_enrollments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_seq_enroll_due ON public.sequence_enrollments (status, next_action_at);
CREATE INDEX idx_seq_enroll_deal ON public.sequence_enrollments (deal_id);
