-- Structured ICPs generated from a prompt and edited before use.
-- Versioned: each edit creates a new row sharing icp_key; the latest version
-- (highest `version` for an icp_key) is the current one.
CREATE TABLE public.icps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  icp_key uuid NOT NULL DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT 'Untitled ICP',
  tier text,
  prompt text,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.icps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own icps" ON public.icps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_icps_user_key_version ON public.icps (user_id, icp_key, version DESC);
