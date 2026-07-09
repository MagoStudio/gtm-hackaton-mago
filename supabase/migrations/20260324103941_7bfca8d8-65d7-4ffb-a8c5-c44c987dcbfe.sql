
-- Fix deal_interactions: drop ALL policy, create separate SELECT (open) + INSERT/UPDATE/DELETE (owner only)
DROP POLICY IF EXISTS "Users can manage own interactions" ON public.deal_interactions;

CREATE POLICY "Anyone authenticated can view interactions"
  ON public.deal_interactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own interactions"
  ON public.deal_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions"
  ON public.deal_interactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions"
  ON public.deal_interactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix outreach_emails: same pattern
DROP POLICY IF EXISTS "Users can manage own emails" ON public.outreach_emails;

CREATE POLICY "Anyone authenticated can view outreach emails"
  ON public.outreach_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own outreach emails"
  ON public.outreach_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outreach emails"
  ON public.outreach_emails FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outreach emails"
  ON public.outreach_emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
