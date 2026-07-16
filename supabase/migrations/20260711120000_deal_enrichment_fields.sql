-- Let deals carry the research produced during lead enrichment (fit score,
-- pains, signals, region, etc.) so approved leads don't arrive bare, and track
-- whether a lead is a company or a person.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS fit_score integer,
  ADD COLUMN IF NOT EXISTS fit_reason text,
  ADD COLUMN IF NOT EXISTS pain_points text[],
  ADD COLUMN IF NOT EXISTS tech_stack text[],
  ADD COLUMN IF NOT EXISTS product_hooks text[],
  ADD COLUMN IF NOT EXISTS recent_signals text[],
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS employee_count text,
  ADD COLUMN IF NOT EXISTS funding_stage text,
  ADD COLUMN IF NOT EXISTS entity_type text;

ALTER TABLE public.lead_candidates
  ADD COLUMN IF NOT EXISTS entity_type text;
