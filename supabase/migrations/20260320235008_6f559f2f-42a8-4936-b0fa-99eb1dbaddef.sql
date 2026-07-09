
-- 1. agent_memories
CREATE TABLE public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_type text NOT NULL,
  memory_type text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  embedding vector(768),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own memories" ON public.agent_memories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_memories_user_agent ON public.agent_memories (user_id, agent_type);

-- 2. agent_conversations
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_type text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON public.agent_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_conversations_user_agent ON public.agent_conversations (user_id, agent_type, created_at);

-- 3. lead_candidates
CREATE TABLE public.lead_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company text,
  contact_name text,
  email text,
  linkedin_url text,
  job_title text,
  company_size text,
  vertical text,
  source text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own leads" ON public.lead_candidates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. agent_settings
CREATE TABLE public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_type text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_type)
);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own settings" ON public.agent_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. pipeline_actions
CREATE TABLE public.pipeline_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  summary text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own actions" ON public.pipeline_actions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. email_sequences (before outreach_emails for FK)
CREATE TABLE public.email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sequences" ON public.email_sequences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. outreach_emails
CREATE TABLE public.outreach_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_name text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'draft',
  sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL,
  sequence_step integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.outreach_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own emails" ON public.outreach_emails FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. social_content
CREATE TABLE public.social_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'linkedin',
  post_text text,
  image_url text,
  status text NOT NULL DEFAULT 'draft',
  variant_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own content" ON public.social_content FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- match_agent_memories function
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding vector(768),
  match_user_id uuid,
  match_agent_type text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.metadata,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories am
  WHERE am.user_id = match_user_id
    AND am.agent_type = match_agent_type
    AND 1 - (am.embedding <=> query_embedding) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
$$;
