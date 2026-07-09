
-- Bot configurations table (soul, identity, instructions per user)
CREATE TABLE public.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'ClawBot',
  soul text DEFAULT '',
  identity jsonb DEFAULT '{"emoji": "🤖", "vibe": "professional"}'::jsonb,
  user_profile text DEFAULT '',
  instructions text DEFAULT '',
  tools_notes text DEFAULT '',
  model_preference text DEFAULT 'google/gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bot configs"
  ON public.bot_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bot skills table (modular capabilities)
CREATE TABLE public.bot_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bot_configs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  instructions text DEFAULT '',
  tool_definitions jsonb DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bot skills"
  ON public.bot_skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bot_configs
      WHERE bot_configs.id = bot_skills.bot_id
        AND bot_configs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bot_configs
      WHERE bot_configs.id = bot_skills.bot_id
        AND bot_configs.user_id = auth.uid()
    )
  );
